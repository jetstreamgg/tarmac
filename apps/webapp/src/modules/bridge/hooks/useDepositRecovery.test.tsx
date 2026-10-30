/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingBridgeStore } from '../store/pendingStore';
import { useDepositRecovery } from './useDepositRecovery';

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  recover: vi.fn(async () => 0)
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('wagmi/actions', () => ({
  getPublicClient: () => ({ getBlockNumber: async () => 100n })
}));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({
    account: '0x0000000000000000000000000000000000000001',
    scope: 'scope-1',
    familyChainId: 1
  })
}));
vi.mock('../adapters/nativeDeposit/discovery', () => ({ discoverNativeDeposits: mocks.discover }));
vi.mock('../tracking/recoverDeposits', () => ({ recoverDeposits: mocks.recover }));

const MINUTE = 60_000;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);
/** A page load: a fresh app with a fresh query cache. */
const load = async () => {
  cleanup();
  renderHook(() => useDepositRecovery(), { wrapper });
  await vi.advanceTimersByTimeAsync(0);
};

describe('useDepositRecovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.restoreAllMocks();
    mocks.discover.mockReset();
    mocks.recover.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('scans again within minutes when a block range could not be read', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: false });
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(mocks.discover.mock.calls.length).toBeGreaterThan(1);
  });

  it('waits the full interval after a complete scan', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(1);
  });

  it('reads nothing on a reload within the interval of a complete scan', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    await load();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(1);
  });

  it('scans on a reload within the interval while a bundle has no hash yet', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    await load();
    vi.spyOn(pendingBridgeStore, 'getSnapshot').mockReturnValue([
      { bundleId: '0xbundle', status: 'pending' } as unknown as ReturnType<
        typeof pendingBridgeStore.getSnapshot
      >[number]
    ]);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(2);
  });

  it('waits twice as long after each scan that could not read a block range', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: false });
    await load();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(3);
  });
});
