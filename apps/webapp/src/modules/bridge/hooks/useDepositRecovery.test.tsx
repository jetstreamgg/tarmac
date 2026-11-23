/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingBridgeStore } from '../store/pendingStore';
import { clearSendIntent, markSendIntent } from '../store/sendIntentStore';
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

  it('counts the next full scan from the earlier load that read everything', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    await load();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    await load();
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(2);
  });

  it('counts a scan stamp ahead of the clock as now', async () => {
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    localStorage.setItem('bridgeRecoveryScan:v1:deposit:scope-1', String(Date.now() + 60 * MINUTE));
    await load();
    expect(mocks.discover).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
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

  describe('a deposit signature a reload lost', () => {
    const recentReads = () =>
      mocks.discover.mock.calls.filter(([args]) => (args as { recentOnly?: boolean }).recentOnly).length;

    it("reads the newest range 2, 6 and 14 minutes after it, and 30 with the full scan, within a complete scan's interval", async () => {
      mocks.discover.mockResolvedValue({ deposits: [], complete: true });
      await load();
      markSendIntent('scope-1', 'ethereum', Date.now());
      await load();
      expect(recentReads()).toBe(0);
      const at = [];
      for (let minute = 1; minute <= 29; minute += 1) {
        await vi.advanceTimersByTimeAsync(MINUTE);
        if (recentReads() > at.length) at.push(minute);
      }
      // Ticks every 2 minutes, so each mark is read on the first tick past it.
      expect(at).toEqual([2, 6, 14]);
      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      // The 30-minute mark falls on the full scan, which reads the newest range too.
      expect(recentReads()).toBe(3);
      expect(mocks.discover).toHaveBeenCalledTimes(5);
    });

    it('reads nothing early once the page cleared it, or for an L2 send', async () => {
      mocks.discover.mockResolvedValue({ deposits: [], complete: true });
      await load();
      const at = Date.now();
      markSendIntent('scope-1', 'ethereum', at);
      clearSendIntent('scope-1', 'ethereum', at);
      markSendIntent('scope-1', 'base', at);
      await load();
      await vi.advanceTimersByTimeAsync(20 * MINUTE);
      expect(recentReads()).toBe(0);
    });

    it('reads it again at its mark when the read skipped a block range', async () => {
      mocks.discover.mockResolvedValue({ deposits: [], complete: true });
      await load();
      markSendIntent('scope-1', 'ethereum', Date.now());
      await load();
      mocks.discover.mockResolvedValue({ deposits: [], complete: false });
      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      expect(recentReads()).toBe(1);
      mocks.discover.mockResolvedValue({ deposits: [], complete: true });
      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      expect(recentReads()).toBe(2);
    });
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
