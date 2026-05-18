import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import type { PendleCombinedMarketHistoryHook } from './pendle';
import { usePendleAllPnlTransactions } from './usePendleAllPnlTransactions';

/**
 * Combined transaction history for the overview, with each row tagged by its
 * source market so the UI can render activity for matured markets the user
 * can no longer click into.
 *
 * Shares the same TanStack cache as usePendleMarketHistory — one
 * /v1/pnl/transactions call serves both views (8 CU flat, regardless of how
 * many markets are in PENDLE_MARKETS). The shared hook already normalizes,
 * filters to PENDLE_MARKETS, attaches market metadata, and sorts desc by
 * timestamp, so this hook is a pure adapter.
 */
export function useAllPendleMarketsHistory(): PendleCombinedMarketHistoryHook {
  const { data, isLoading, error, refetch } = usePendleAllPnlTransactions();

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
