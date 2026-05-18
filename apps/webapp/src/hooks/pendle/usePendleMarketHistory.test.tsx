/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PENDLE_MARKETS, PendleHistoryAction } from './constants';
import type { PendlePnlTransactionRaw } from './pendle';

vi.mock('wagmi', () => ({
  useConnection: vi.fn()
}));

vi.mock('./pendleApiClient', () => ({
  fetchPendlePnlTransactionsForUser: vi.fn()
}));

import { useConnection } from 'wagmi';
import { fetchPendlePnlTransactionsForUser } from './pendleApiClient';
import { usePendleMarketHistory } from './usePendleMarketHistory';

const USER = '0x1111111111111111111111111111111111111111' as const;
const MARKET_USDG = PENDLE_MARKETS.find(m => m.name === 'PT-USDG')!.marketAddress;
const MARKET_USDE = PENDLE_MARKETS.find(m => m.name === 'PT-USDe')!.marketAddress;

function wireRow(overrides: Partial<PendlePnlTransactionRaw>): PendlePnlTransactionRaw {
  return {
    chainId: 1,
    market: `1-${MARKET_USDG}`,
    timestamp: '2026-01-01T00:00:00Z',
    action: 'buyPt',
    txHash: '0xaaaa000000000000000000000000000000000000000000000000000000000001',
    txValueAsset: 100,
    assetUsd: 1,
    effectivePtExchangeRate: 1.02,
    ...overrides
  };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('usePendleMarketHistory — single-endpoint PnL feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces buyPt rows with ptAmount = txValueAsset × effectivePtExchangeRate', async () => {
    // The formula was verified against a real wallet's history: txValueAsset
    // × effectivePtExchangeRate reproduces v5's notional.pt to ≥4 decimals.
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'buyPt',
        market: `1-${MARKET_USDG}`,
        txValueAsset: 100,
        effectivePtExchangeRate: 1.0234,
        assetUsd: 1
      })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.BUY_PT);
    expect(result.current.data?.[0].ptAmount).toBeCloseTo(102.34, 6);
    expect(result.current.data?.[0].valueUsd).toBe(100);
  });

  it('surfaces sellPt rows using the same formula', async () => {
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'sellPt',
        market: `1-${MARKET_USDG}`,
        txValueAsset: 50,
        effectivePtExchangeRate: 0.98,
        assetUsd: 1.001
      })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.SELL_PT);
    expect(result.current.data?.[0].ptAmount).toBeCloseTo(49, 6);
    expect(result.current.data?.[0].valueUsd).toBeCloseTo(50.05, 6);
  });

  it('surfaces redeemPy rows with ptAmount = txValueAsset (1 PT ≈ 1 underlying at redemption)', async () => {
    // Redeem rows ignore effectivePtExchangeRate (which is `0` for redeems on
    // the wire) — the underlying received equals the PT redeemed.
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'redeemPy',
        market: `1-${MARKET_USDG}`,
        txValueAsset: 800,
        effectivePtExchangeRate: 0,
        assetUsd: 1
      })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.REDEEM_PY);
    expect(result.current.data?.[0].ptAmount).toBe(800);
    expect(result.current.data?.[0].valueUsd).toBe(800);
  });

  it('drops redeem rows with txValueAsset=0 (YT-only no-op redeems)', async () => {
    // PnL feed reports a redeemPy entry but no underlying actually moved —
    // surface nothing rather than a confusing "0 USDG" row.
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({ action: 'redeemPy', market: `1-${MARKET_USDG}`, txValueAsset: 0, assetUsd: 1 })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it('filters out every non-surfaced action (mintPy, buyYt, addLiquiditySingleToken, …)', async () => {
    // A real PnL feed includes ~28 action values. We surface exactly three;
    // everything else must be dropped silently at the transport boundary.
    const buyPt = wireRow({
      action: 'buyPt',
      market: `1-${MARKET_USDG}`,
      txHash: '0xbbbb000000000000000000000000000000000000000000000000000000000001'
    });
    const noise = ['mintPy', 'buyYt', 'sellYt', 'addLiquiditySingleToken', 'swapPtToYt', 'transferIn'].map(
      (action, i) =>
        wireRow({
          action,
          market: `1-${MARKET_USDG}`,
          txHash: `0xcccc00000000000000000000000000000000000000000000000000000000000${i}` as `0x${string}`
        })
    );

    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([buyPt, ...noise]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.BUY_PT);
  });

  it('filters rows by market: only rows for the requested market appear', async () => {
    // The shared cache may hold rows across multiple markets. The per-market
    // hook's select filter must surface only the target market.
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'buyPt',
        market: `1-${MARKET_USDG}`,
        txHash: '0xdddd000000000000000000000000000000000000000000000000000000000001'
      }),
      wireRow({
        action: 'buyPt',
        market: `1-${MARKET_USDE}`,
        txHash: '0xdddd000000000000000000000000000000000000000000000000000000000002'
      })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].txHash).toBe(
      '0xdddd000000000000000000000000000000000000000000000000000000000001'
    );
  });

  it('accepts the raw-address `market` form (what /v1/pnl/transactions actually returns)', async () => {
    // Verified live: the wire returns market="0xc5b32…", not "1-0xc5b32…".
    // Other Pendle endpoints use the chainId-prefixed form — we accept both
    // so the resolver doesn't silently drop every row on the production API.
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({ action: 'buyPt', market: MARKET_USDG })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.BUY_PT);
  });

  it('drops rows whose market is not in PENDLE_MARKETS', async () => {
    // Unfiltered /v1/pnl/transactions returns activity across every Pendle
    // market the user has touched, not just ours. Unknown markets must drop.
    const unknownMarket = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({ action: 'buyPt', market: `1-${unknownMarket}` })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(unknownMarket as `0x${string}`), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it('sorts results desc by timestamp', async () => {
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'buyPt',
        market: `1-${MARKET_USDG}`,
        timestamp: '2026-01-01T00:00:00Z',
        txHash: '0xeeee000000000000000000000000000000000000000000000000000000000001'
      }),
      wireRow({
        action: 'redeemPy',
        market: `1-${MARKET_USDG}`,
        timestamp: '2026-06-01T00:00:00Z',
        txValueAsset: 100,
        txHash: '0xeeee000000000000000000000000000000000000000000000000000000000002'
      })
    ]);

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].action).toBe(PendleHistoryAction.REDEEM_PY);
    expect(result.current.data?.[1].action).toBe(PendleHistoryAction.BUY_PT);
  });

  it('surfaces the error when the PnL endpoint fails (single-query single-error)', async () => {
    vi.mocked(fetchPendlePnlTransactionsForUser).mockRejectedValueOnce(new Error('503'));

    const { result } = renderHook(() => usePendleMarketHistory(MARKET_USDG), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });

  it('is disabled (no fetch) when no wallet is connected', async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined } as unknown as ReturnType<
      typeof useConnection
    >);

    renderHook(() => usePendleMarketHistory(MARKET_USDG), { wrapper: makeWrapper() });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchPendlePnlTransactionsForUser).not.toHaveBeenCalled();
  });
});
