/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWithdrawalRecovery } from './useWithdrawalRecovery';

const ACCOUNT = '0x0000000000000000000000000000000000000001';
const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  recover: vi.fn(async () => 0),
  lookup: vi.fn(),
  clients: new Set<string>(['base', 'optimism', 'unichain', 'arbitrum'])
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, scope: 'scope-1', familyChainId: 1 })
}));
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({
    getClient: (network: string) =>
      mocks.clients.has(network) ? { network, getBlockNumber: async () => 100n } : undefined
  })
}));
vi.mock('../adapters/nativeWithdrawal/discovery', () => ({ discoverNativeWithdrawals: mocks.discover }));
vi.mock('../adapters/nativeWithdrawal/lookup', () => ({ lookupNativeWithdrawal: mocks.lookup }));
vi.mock('../tracking/recoverWithdrawals', () => ({ recoverWithdrawals: mocks.recover }));

const MINUTE = 60_000;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);
/** A page load: a fresh app with a fresh query cache. */
const load = async () => {
  cleanup();
  renderHook(() => useWithdrawalRecovery(), { wrapper });
  await vi.advanceTimersByTimeAsync(0);
};
const scanned = () => mocks.discover.mock.calls.map(([args]) => args.network).sort();

describe('useWithdrawalRecovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mocks.discover.mockReset();
    mocks.recover.mockClear();
    mocks.lookup.mockReset();
    mocks.clients = new Set(['base', 'optimism', 'unichain', 'arbitrum']);
  });
  afterEach(() => vi.useRealTimers());

  it("scans each L2 up to its head for the account's withdrawals and recovers them by that L2's lookup", async () => {
    mocks.discover.mockImplementation(async ({ network }: { network: string }) => ({
      withdrawals: [{ txHash: `0x${network}`, blockNumber: 1n }],
      complete: true
    }));
    renderHook(() => useWithdrawalRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(scanned()).toEqual(['arbitrum', 'base', 'optimism', 'unichain']);
    expect(mocks.discover.mock.calls[0][0]).toMatchObject({ account: ACCOUNT, toBlock: 100n });
    expect(mocks.recover).toHaveBeenCalledTimes(4);
    const base = (
      mocks.recover.mock.calls as unknown as [
        { withdrawals: { txHash: string }[]; lookup: (h: string) => void }
      ][]
    )
      .map(([args]) => args)
      .find(args => args.withdrawals[0]?.txHash === '0xbase')!;
    expect(base).toMatchObject({ scope: 'scope-1' });
    base.lookup('0xbase');
    expect(mocks.lookup).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'base', txHash: '0xbase', account: ACCOUNT })
    );
  });

  it('skips an L2 the app has no client for', async () => {
    mocks.clients = new Set(['base']);
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    renderHook(() => useWithdrawalRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(scanned()).toEqual(['base']);
  });

  it('scans again within minutes when any L2 could not be fully read', async () => {
    mocks.discover.mockImplementation(async ({ network }: { network: string }) => {
      if (network === 'arbitrum') throw new Error('head unreadable');
      return { withdrawals: [], complete: true };
    });
    renderHook(() => useWithdrawalRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.recover).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(mocks.discover.mock.calls.length).toBeGreaterThan(4);
  });

  it('waits the full interval after complete scans', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    renderHook(() => useWithdrawalRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(4);
  });

  it('reads nothing on a reload within the interval of a complete scan', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(4);
  });

  it('scans again on a load once the interval has passed', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    cleanup();
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(8);
  });

  it('scans every L2 again on a reload after a partial scan', async () => {
    mocks.discover.mockImplementation(async ({ network }: { network: string }) => {
      if (network === 'arbitrum') throw new Error('head unreadable');
      return { withdrawals: [], complete: true };
    });
    await load();
    await load();
    expect(scanned()).toEqual([
      'arbitrum',
      'arbitrum',
      'base',
      'base',
      'optimism',
      'optimism',
      'unichain',
      'unichain'
    ]);
  });

  it('retries only the L2 it could not read, waiting twice as long each time', async () => {
    mocks.discover.mockImplementation(async ({ network }: { network: string }) => {
      if (network === 'arbitrum') throw new Error('head unreadable');
      return { withdrawals: [], complete: true };
    });
    await load();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toEqual(['arbitrum', 'arbitrum', 'base', 'optimism', 'unichain']);
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(6);
    expect(mocks.discover.mock.calls.at(-1)![0].network).toBe('arbitrum');
  });

  it('goes back to the full interval once the unread L2 reads', async () => {
    let arbitrumDown = true;
    mocks.discover.mockImplementation(async ({ network }: { network: string }) => {
      if (network === 'arbitrum' && arbitrumDown) throw new Error('head unreadable');
      return { withdrawals: [], complete: true };
    });
    await load();
    arbitrumDown = false;
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(5);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(5);
  });
});
