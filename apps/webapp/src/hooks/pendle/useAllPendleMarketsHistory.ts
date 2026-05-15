import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PENDLE_MARKETS } from './constants';
import type { PendleCombinedHistoryRow, PendleCombinedMarketHistoryHook } from './pendle';
import { loadPendleMarketHistoryRows } from './usePendleMarketHistory';

/**
 * Hook for the overview's combined transaction history. Fans
 * loadPendleMarketHistoryRows across every entry in PENDLE_MARKETS so users
 * can see activity for matured markets they can no longer click into.
 *
 * Each market is its own useQueries entry keyed identically to
 * usePendleMarketHistory, so the per-market cache is shared: visiting a
 * market detail then returning to the overview reuses the cached rows
 * instead of refetching them. Per-market failures stay isolated — one
 * market's outage doesn't blank out activity from the others, and we only
 * surface `error` when every market has rejected.
 */
export function useAllPendleMarketsHistory(): PendleCombinedMarketHistoryHook {
  const { address: userAddress } = useConnection();

  const results = useQueries({
    queries: PENDLE_MARKETS.map(market => ({
      queryKey: ['pendle-market-history', market.marketAddress.toLowerCase(), userAddress?.toLowerCase()],
      queryFn: () => loadPendleMarketHistoryRows(market.marketAddress, userAddress!),
      enabled: !!userAddress,
      staleTime: 60_000,
      refetchOnWindowFocus: false
    }))
  });

  const allFailed = results.length > 0 && results.every(r => r.error);
  const anyResolved = results.some(r => r.data !== undefined);

  const data = useMemo<PendleCombinedHistoryRow[] | undefined>(() => {
    if (allFailed || !anyResolved) return undefined;
    const merged = results.flatMap((r, i) =>
      r.data ? r.data.map(row => ({ ...row, market: PENDLE_MARKETS[i] })) : []
    );
    merged.sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)));
    return merged;
  }, [results, allFailed, anyResolved]);

  const error = allFailed ? (results.find(r => r.error)?.error ?? null) : null;
  const isLoading = results.some(r => r.isLoading);

  const mutate = () => {
    results.forEach(r => r.refetch());
  };

  return {
    isLoading,
    data,
    error,
    mutate,
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
