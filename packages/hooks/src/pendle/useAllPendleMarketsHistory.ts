import { useQuery } from '@tanstack/react-query';
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
 * Each market's fetch is independent (Promise.allSettled) — one market's API
 * failure shouldn't blank out activity from the others. We only throw when
 * *every* market rejects, which usually means the API is down and surfacing
 * the error is the right UX.
 *
 * The single-market hook's queryKey doesn't overlap with this one, so the
 * cache isn't shared. That means visiting a market detail then returning to
 * the overview will redundantly refetch that market's history. Acceptable
 * for the current three-market config; revisit if PENDLE_MARKETS grows.
 */
export function useAllPendleMarketsHistory(): PendleCombinedMarketHistoryHook {
  const { address: userAddress } = useConnection();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendle-all-markets-history', userAddress?.toLowerCase()],
    queryFn: async (): Promise<PendleCombinedHistoryRow[]> => {
      if (!userAddress) return [];

      const perMarket = await Promise.allSettled(
        PENDLE_MARKETS.map(async market => {
          const rows = await loadPendleMarketHistoryRows(market.marketAddress, userAddress);
          return rows.map(row => ({ ...row, market }));
        })
      );

      // If every market failed, propagate — that's a real outage, not a
      // per-market blip. Otherwise log and continue with whichever succeeded.
      const succeeded = perMarket.filter(s => s.status === 'fulfilled');
      if (succeeded.length === 0 && perMarket.length > 0) {
        const firstFailure = perMarket.find(s => s.status === 'rejected');
        throw firstFailure && firstFailure.status === 'rejected'
          ? firstFailure.reason
          : new Error('Pendle market history fetch failed for every market');
      }
      perMarket.forEach((s, i) => {
        if (s.status === 'rejected') {
          console.warn(`Pendle market history failed for ${PENDLE_MARKETS[i].name}:`, s.reason);
        }
      });

      const all = succeeded.flatMap(s => (s as PromiseFulfilledResult<PendleCombinedHistoryRow[]>).value);
      all.sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)));
      return all;
    },
    enabled: !!userAddress,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

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
