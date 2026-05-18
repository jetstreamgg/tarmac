import { useMemo } from 'react';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import type { PendleHistoryRow, PendleMarketHistoryHook } from './pendle';
import { usePendleAllPnlTransactions } from './usePendleAllPnlTransactions';

/**
 * Hook for the latest market activity for a Pendle market scoped to the
 * connected user. We never show unscoped market activity, so the query is
 * disabled until a wallet is connected.
 *
 * Backed by a single unfiltered call to /v1/pnl/transactions via the shared
 * usePendleAllPnlTransactions cache. Visiting a market detail then returning
 * to the overview (or vice versa) reuses the same in-memory rows — one
 * TanStack query for both views.
 *
 * Pendle's API doesn't serve Tenderly, so the transport layer rewrites
 * Tenderly chain IDs to mainnet. The PnL feed lags chain tip by ~20s
 * (empirical, n=2, May 2026 — Pendle's docs claim "few minutes" but the
 * observed lag is much tighter); PendleWidgetPane fires a delayed refresh
 * after tx success to bridge that window.
 */
export function usePendleMarketHistory(marketAddress: `0x${string}` | undefined): PendleMarketHistoryHook {
  const { data: allRows, isLoading, error, refetch } = usePendleAllPnlTransactions();
  const targetMarket = marketAddress?.toLowerCase();

  const data = useMemo<PendleHistoryRow[] | undefined>(() => {
    if (!allRows) return undefined;
    if (!targetMarket) return [];
    return (
      allRows
        .filter(r => r.market.marketAddress.toLowerCase() === targetMarket)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ market: _market, ...rest }) => rest)
    );
  }, [allRows, targetMarket]);

  return {
    isLoading,
    data,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Pendle Markets API',
        href: 'https://api-v2.pendle.finance/core/docs',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
