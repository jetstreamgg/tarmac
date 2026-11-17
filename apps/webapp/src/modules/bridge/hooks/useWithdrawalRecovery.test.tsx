/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import { pendingBridgeStore } from '../store/pendingStore';
import { clearSendIntent, markSendIntent } from '../store/sendIntentStore';
import { useWithdrawalRecovery } from './useWithdrawalRecovery';

const ACCOUNT = '0x0000000000000000000000000000000000000001';
const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  recover: vi.fn(async () => 0),
  lookup: vi.fn(),
  burns: vi.fn<(args: { network: string }) => Promise<{ burns: unknown[]; complete: boolean }>>(),
  recoverBurns: vi.fn(async () => 0),
  burnLookup: vi.fn(),
  clients: new Set<string>(['base', 'optimism', 'unichain', 'arbitrum']),
  head: 100n
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, scope: 'scope-1', familyChainId: 1 })
}));
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({
    getClient: (network: string) =>
      mocks.clients.has(network) ? { network, getBlockNumber: async () => mocks.head } : undefined
  })
}));
vi.mock('../adapters/nativeWithdrawal/discovery', () => ({ discoverNativeWithdrawals: mocks.discover }));
vi.mock('../adapters/nativeWithdrawal/lookup', () => ({ lookupNativeWithdrawal: mocks.lookup }));
vi.mock('../tracking/recoverWithdrawals', () => ({ recoverWithdrawals: mocks.recover }));
vi.mock('../adapters/cctp/discovery', () => ({ discoverCctpBurns: mocks.burns }));
vi.mock('../tracking/recoverCctpBurns', () => ({ recoverCctpBurns: mocks.recoverBurns }));
vi.mock('../adapters/cctp/lookup', () => ({ lookupCctpBurn: mocks.burnLookup }));

const MINUTE = 60_000;
let cardSeq = 0;
const card = (from: 'arbitrum' | 'base') =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 1n,
    from,
    to: 'ethereum',
    route: nativeWithdrawalRoute(from),
    txHash: `0x${(++cardSeq).toString(16).padStart(64, '0')}`,
    now: Date.now()
  });
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
    mocks.burns.mockReset();
    mocks.burns.mockResolvedValue({ burns: [], complete: true });
    mocks.recoverBurns.mockClear();
    mocks.clients = new Set(['base', 'optimism', 'unichain', 'arbitrum']);
    mocks.head = 100n;
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

  it("reads no CCTP burns on a full scan: the account's other burns may be another app's", async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    expect(scanned()).toHaveLength(4);
    expect(mocks.burns).not.toHaveBeenCalled();
    expect(mocks.recoverBurns).not.toHaveBeenCalled();
  });

  it("reads a lost burn signature's L2 in its last blocks, and recovers only burns of the signed amount", async () => {
    mocks.head = 1_000_000n;
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    const signed = {
      txHash: '0xburn',
      blockNumber: 1n,
      amount: 7n,
      mintRecipient: '0x',
      destinationDomain: 0
    };
    const other = { ...signed, txHash: '0xother', amount: 8n };
    mocks.burns.mockResolvedValue({ burns: [signed, other], complete: true });
    markSendIntent('scope-1', 'base', Date.now(), 7n);
    await load();
    expect(mocks.burns).toHaveBeenCalledTimes(1);
    expect(mocks.burns.mock.calls[0][0]).toMatchObject({
      network: 'base',
      account: ACCOUNT,
      toBlock: 1_000_000n,
      fromBlock: 994_000n
    });
    const [[args]] = mocks.recoverBurns.mock.calls as unknown as [
      { network: string; burns: unknown[]; scope: string; lookup: (h: string) => void }
    ][];
    expect(args).toMatchObject({ network: 'base', scope: 'scope-1', burns: [signed] });
    args.lookup('0xburn');
    expect(mocks.burnLookup).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'base', txHash: '0xburn', account: ACCOUNT })
    );
  });

  it("reads a lost burn signature's L2 for burns only, and again when they could not be read", async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    mocks.burns.mockResolvedValueOnce({ burns: [], complete: false });
    markSendIntent('scope-1', 'unichain', Date.now(), 7n);
    await load();
    // Read at its 2-minute mark, then again 2 minutes later since that read failed.
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.discover).not.toHaveBeenCalled();
    expect(mocks.burns.mock.calls.map(([args]) => args.network)).toEqual(['unichain', 'unichain']);
  });

  it('reads no burns for a lost withdrawal signature', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    markSendIntent('scope-1', 'base', Date.now());
    await load();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toContain('base');
    expect(mocks.burns).not.toHaveBeenCalled();
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

  it("reads the L2 of a signature a reload lost 2, 6, 14 and 30 minutes after it, within a complete scan's interval", async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    mocks.discover.mockClear();
    markSendIntent('scope-1', 'arbitrum', Date.now());
    await load();
    expect(scanned()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toEqual(['arbitrum']);
    await vi.advanceTimersByTimeAsync(4 * MINUTE);
    expect(scanned()).toEqual(['arbitrum', 'arbitrum']);
    await vi.advanceTimersByTimeAsync(8 * MINUTE);
    expect(scanned()).toEqual(['arbitrum', 'arbitrum', 'arbitrum']);
    // The full scan, 30 minutes after the first load's, reads Arbitrum once with the others.
    await vi.advanceTimersByTimeAsync(6 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(7);
    // 30 minutes after the signature.
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(8);
    expect(mocks.discover.mock.calls.at(-1)![0].network).toBe('arbitrum');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(8);
  });

  it('reads the L2 at once on a reload past the first mark', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    markSendIntent('scope-1', 'base', Date.now());
    cleanup();
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    await load();
    expect(scanned()).toEqual(['base']);
  });

  it('reads no L2 early once the page cleared the signature', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    const at = Date.now();
    markSendIntent('scope-1', 'arbitrum', at);
    clearSendIntent('scope-1', 'arbitrum', at);
    await load();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    expect(scanned()).toEqual([]);
  });

  it('reads no L2 early for a signature asked for more than 35 minutes ago', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    markSendIntent('scope-1', 'arbitrum', Date.now() - 36 * MINUTE);
    await load();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    expect(scanned()).toEqual([]);
  });

  it("retries a lost signature's L2 that could not be read", async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockReset();
    mocks.discover.mockRejectedValueOnce(new Error('head unreadable'));
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    markSendIntent('scope-1', 'arbitrum', Date.now());
    await load();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toEqual(['arbitrum']);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toEqual(['arbitrum', 'arbitrum']);
  });

  it("keeps reading a lost signature's L2 after a scan finds another withdrawal there", async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    mocks.discover.mockClear();
    markSendIntent('scope-1', 'arbitrum', Date.now());
    // One the account receives, sent from elsewhere after the signature.
    mocks.recover.mockImplementation((async ({ store }: { store: typeof pendingBridgeStore }) => {
      store.upsert('scope-1', card('arbitrum'));
      return 1;
    }) as never);
    await load();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(scanned()).toEqual(['arbitrum']);
    await vi.advanceTimersByTimeAsync(4 * MINUTE);
    expect(scanned()).toEqual(['arbitrum', 'arbitrum']);
    mocks.recover.mockImplementation(async () => 0);
  });

  it('counts the next full scan from the earlier load that read everything', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    await load();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(8);
  });

  it('counts a scan stamp ahead of the clock as now', async () => {
    mocks.discover.mockResolvedValue({ withdrawals: [], complete: true });
    localStorage.setItem('bridgeRecoveryScan:v1:withdrawal:scope-1', String(Date.now() + 60 * MINUTE));
    await load();
    expect(mocks.discover).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(4);
  });
});
