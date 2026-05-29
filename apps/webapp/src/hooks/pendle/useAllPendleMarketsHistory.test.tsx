/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { useAllPendleMarketsHistory } from './useAllPendleMarketsHistory';

const USER = '0x1111111111111111111111111111111111111111' as const;

function wireRow(overrides: Partial<PendlePnlTransactionRaw>): PendlePnlTransactionRaw {
  return {
    chainId: 1,
    market: `1-${PENDLE_MARKETS[0].marketAddress}`,
    timestamp: '2026-01-01T00:00:00Z',
    action: 'buyPt',
    txHash: '0xaaaa000000000000000000000000000000000000000000000000000000000001',
    txValueAsset: 100,
    assetUsd: 1,
    effectivePtExchangeRate: 1,
    ...overrides
  };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAllPendleMarketsHistory — single PnL endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns rows for every supported market, each tagged with its source market', async () => {
    const rows = PENDLE_MARKETS.flatMap((market, i) => [
      wireRow({
        action: 'buyPt',
        market: `1-${market.marketAddress}`,
        timestamp: `2026-0${i + 1}-15T00:00:00Z`,
        txHash: `0xbbbb${i.toString(16).padStart(4, '0')}${'buy'.padEnd(56, '0')}` as `0x${string}`,
        txValueAsset: 100 * (i + 1),
        effectivePtExchangeRate: 1
      }),
      wireRow({
        action: 'redeemPy',
        market: `1-${market.marketAddress}`,
        timestamp: `2026-0${i + 1}-20T00:00:00Z`,
        txHash: `0xbbbb${i.toString(16).padStart(4, '0')}${'red'.padEnd(56, '0')}` as `0x${string}`,
        txValueAsset: 50 * (i + 1)
      })
    ]);

    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce(rows);

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(PENDLE_MARKETS.length * 2);

    for (const row of result.current.data ?? []) {
      const inMarket = PENDLE_MARKETS.find(m => m.marketAddress === row.market.marketAddress);
      expect(inMarket).toBeDefined();
    }
  });

  it('sorts merged rows desc by timestamp', async () => {
    const market = PENDLE_MARKETS[0];
    const rows: PendlePnlTransactionRaw[] = [
      wireRow({
        market: `1-${market.marketAddress}`,
        timestamp: '2026-01-01T00:00:00Z',
        txHash: '0xcccc000000000000000000000000000000000000000000000000000000000001'
      }),
      wireRow({
        market: `1-${market.marketAddress}`,
        timestamp: '2026-12-31T00:00:00Z',
        txHash: '0xcccc000000000000000000000000000000000000000000000000000000000002'
      }),
      wireRow({
        market: `1-${market.marketAddress}`,
        timestamp: '2026-06-15T00:00:00Z',
        txHash: '0xcccc000000000000000000000000000000000000000000000000000000000003'
      })
    ];

    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce(rows);

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const timestamps = result.current.data!.map(r => new Date(r.timestamp).valueOf());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('drops rows for markets outside PENDLE_MARKETS', async () => {
    const supported = PENDLE_MARKETS[0];
    const unknown = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;

    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        market: `1-${supported.marketAddress}`,
        txHash: '0xdddd000000000000000000000000000000000000000000000000000000000001'
      }),
      wireRow({
        market: `1-${unknown}`,
        txHash: '0xdddd000000000000000000000000000000000000000000000000000000000002'
      })
    ]);

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].market.marketAddress).toBe(supported.marketAddress);
  });

  it('surfaces the error when the PnL endpoint fails (single-query single-error state)', async () => {
    vi.mocked(fetchPendlePnlTransactionsForUser).mockRejectedValueOnce(new Error('503'));

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });

  it('is disabled (no fetch) when no wallet is connected', async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined } as unknown as ReturnType<
      typeof useConnection
    >);

    renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchPendlePnlTransactionsForUser).not.toHaveBeenCalled();
  });

  it('mapped action enum: buyPt → BUY_PT, sellPt → SELL_PT, redeemPy → REDEEM_PY', async () => {
    // Tightens the transport-boundary contract — if these mappings are ever
    // accidentally re-cased, this catches it before the UI does.
    const market = PENDLE_MARKETS[0];
    vi.mocked(fetchPendlePnlTransactionsForUser).mockResolvedValueOnce([
      wireRow({
        action: 'buyPt',
        market: `1-${market.marketAddress}`,
        timestamp: '2026-01-01T00:00:00Z',
        txHash: '0xeeee000000000000000000000000000000000000000000000000000000000001'
      }),
      wireRow({
        action: 'sellPt',
        market: `1-${market.marketAddress}`,
        timestamp: '2026-02-01T00:00:00Z',
        txHash: '0xeeee000000000000000000000000000000000000000000000000000000000002'
      }),
      wireRow({
        action: 'redeemPy',
        market: `1-${market.marketAddress}`,
        timestamp: '2026-03-01T00:00:00Z',
        txValueAsset: 1,
        txHash: '0xeeee000000000000000000000000000000000000000000000000000000000003'
      })
    ]);

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const actions = result.current.data!.map(r => r.action).sort();
    expect(actions).toEqual(
      [PendleHistoryAction.BUY_PT, PendleHistoryAction.SELL_PT, PendleHistoryAction.REDEEM_PY].sort()
    );
  });
});
