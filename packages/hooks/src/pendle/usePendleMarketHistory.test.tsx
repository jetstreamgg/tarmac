/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PendleHistoryAction } from './constants';
import type { PendlePnlTransactionRaw, PendleTransactionRaw } from './pendle';

vi.mock('wagmi', () => ({
  useConnection: vi.fn()
}));

vi.mock('./pendleApiClient', () => ({
  fetchPendleMarketTransactions: vi.fn(),
  fetchPendlePnlTransactions: vi.fn()
}));

import { useConnection } from 'wagmi';
import { fetchPendleMarketTransactions, fetchPendlePnlTransactions } from './pendleApiClient';
import { usePendleMarketHistory } from './usePendleMarketHistory';

const MARKET = '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as const;
const USER = '0x1111111111111111111111111111111111111111' as const;
const HASH_BUY = '0xaaaa000000000000000000000000000000000000000000000000000000000001' as const;
const HASH_SELL = '0xaaaa000000000000000000000000000000000000000000000000000000000002' as const;
const HASH_REDEEM = '0xaaaa000000000000000000000000000000000000000000000000000000000003' as const;

function makeTrade(
  action: PendleHistoryAction.BUY_PT | PendleHistoryAction.SELL_PT,
  txHash: `0x${string}`,
  timestamp: string,
  pt: number,
  value: number,
  id: string
): PendleTransactionRaw {
  return {
    id,
    market: MARKET,
    timestamp,
    chainId: 1,
    txHash,
    value,
    type: 'TRADES',
    action,
    txOrigin: USER,
    impliedApy: 0,
    notional: { pt }
  };
}

function makeRedeem(
  txHash: `0x${string}`,
  timestamp: string,
  ptUnit: number,
  txValueAsset: number = ptUnit
): PendlePnlTransactionRaw {
  return {
    timestamp,
    action: 'redeemPy',
    market: `1-${MARKET}`,
    txHash,
    ptData: { unit: ptUnit },
    txValueAsset
  };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('usePendleMarketHistory — merge, dedupe, sort, fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges v5 trades and v1 redeems into a single normalized list', async () => {
    const buy = makeTrade(PendleHistoryAction.BUY_PT, HASH_BUY, '2026-01-01T00:00:00Z', 1000, 1000, 'tx-1');
    const redeem = makeRedeem(HASH_REDEEM, '2026-06-01T00:00:00Z', 800);

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([buy]);
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([redeem]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(2);
    // Sorted desc by timestamp: redeem (June) first, buy (January) second.
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.REDEEM_PY);
    expect(result.current.data?.[0].txHash).toBe(HASH_REDEEM);
    // Redeem rows sourced from v1's txValueAsset. 1 PT = 1 underlying at
    // redemption, so ptAmount and underlyingAmount are the same number.
    // valueUsd stays 0 — computeMaturedEarnings only reads it for trades.
    expect(result.current.data?.[0].ptAmount).toBe(800);
    expect(result.current.data?.[0].valueUsd).toBe(0);
    expect(result.current.data?.[0].underlyingAmount).toBe(800);
    expect(result.current.data?.[1].action).toBe(PendleHistoryAction.BUY_PT);
    expect(result.current.data?.[1].txHash).toBe(HASH_BUY);
    expect(result.current.data?.[1].ptAmount).toBe(1000);
    expect(result.current.data?.[1].valueUsd).toBe(1000);
    expect(result.current.data?.[1].underlyingAmount).toBe(1000);
  });

  it('drops redeem rows where txValueAsset is zero (YT-only no-op redeems)', async () => {
    // PnL feed reports a redeemPy entry but no underlying actually moved —
    // surface nothing rather than a confusing "0 USDe" row.
    const noopRedeem = makeRedeem(HASH_REDEEM, '2026-06-01T00:00:00Z', 0, 0);

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([]);
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([noopRedeem]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it('filters out non-PT trade actions from the v5 feed (e.g. BUY_YT)', async () => {
    const buyPt = makeTrade(PendleHistoryAction.BUY_PT, HASH_BUY, '2026-01-01T00:00:00Z', 1000, 1000, 'tx-1');
    const buyYt = { ...buyPt, id: 'tx-2', action: 'BUY_YT' } as unknown as PendleTransactionRaw;

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([buyPt, buyYt]);
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.BUY_PT);
  });

  it('filters the v1 PnL feed to redeemPy only (drops mintPy, swapPtToYt, …)', async () => {
    const redeem = makeRedeem(HASH_REDEEM, '2026-06-01T00:00:00Z', 100);
    const mint = { ...makeRedeem(HASH_BUY, '2026-05-01T00:00:00Z', 100), action: 'mintPy' };

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([]);
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([redeem, mint]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.REDEEM_PY);
  });

  it('dedupes by txHash (defensive: prefers the v5 trade row over the v1 row)', async () => {
    // Same txHash present on both feeds — should appear once, as a BUY_PT row.
    const buy = makeTrade(PendleHistoryAction.BUY_PT, HASH_BUY, '2026-01-01T00:00:00Z', 1000, 1000, 'tx-1');
    const collidingRedeem = makeRedeem(HASH_BUY, '2026-06-01T00:00:00Z', 1000);

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([buy]);
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([collidingRedeem]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.BUY_PT);
  });

  it('falls back to v5-only when the PnL endpoint rejects (warns, does not throw)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buy = makeTrade(PendleHistoryAction.BUY_PT, HASH_BUY, '2026-01-01T00:00:00Z', 1000, 1000, 'tx-1');
    const sell = makeTrade(PendleHistoryAction.SELL_PT, HASH_SELL, '2026-02-01T00:00:00Z', 200, 210, 'tx-2');

    vi.mocked(fetchPendleMarketTransactions).mockResolvedValueOnce([buy, sell]);
    vi.mocked(fetchPendlePnlTransactions).mockRejectedValueOnce(new Error('500'));

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map(r => r.action)).toEqual([
      PendleHistoryAction.SELL_PT,
      PendleHistoryAction.BUY_PT
    ]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('surfaces an error when the v5 trades endpoint fails (primary feed is load-bearing)', async () => {
    vi.mocked(fetchPendleMarketTransactions).mockRejectedValueOnce(new Error('500'));
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });

  it('is disabled (no fetch) when no wallet is connected', async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined } as unknown as ReturnType<
      typeof useConnection
    >);

    renderHook(() => usePendleMarketHistory(MARKET), { wrapper: makeWrapper() });

    // Yield once to make sure no microtask schedules a fetch.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchPendleMarketTransactions).not.toHaveBeenCalled();
    expect(fetchPendlePnlTransactions).not.toHaveBeenCalled();
  });
});
