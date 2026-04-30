import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PENDLE_MARKETS } from './constants';
import { PendleMarketsStats, PendleMarketsStatsHook } from './pendle';
import { fetchPendleMarketsByIds } from './pendleApiClient';

/**
 * Hook for fetching headline stats (implied APY, TVL) for every market in
 * PENDLE_MARKETS in a single API call.
 *
 * The result is keyed by `marketAddress` exactly as it appears in
 * PENDLE_MARKETS, so consumers can do `marketsApi?.[market.marketAddress]`
 * for either an overview list (iterate PENDLE_MARKETS) or a detail view
 * (look up the active market). One cache entry serves both.
 *
 * Our integration only adds mainnet markets to PENDLE_MARKETS, and Pendle's
 * API doesn't serve Tenderly, so we always query mainnet regardless of the
 * connected chain.
 */
export function usePendleMarketsApiData(): PendleMarketsStatsHook {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendle-markets-api'],
    queryFn: async (): Promise<PendleMarketsStats> => {
      const results = await fetchPendleMarketsByIds(
        mainnet.id,
        PENDLE_MARKETS.map(m => m.marketAddress)
      );

      const map: PendleMarketsStats = {} as PendleMarketsStats;
      PENDLE_MARKETS.forEach(market => {
        const summary = results.find(
          r => r.address.toLowerCase() === market.marketAddress.toLowerCase()
        );
        if (!summary) return;
        const tvl = summary.details.totalTvl;
        map[market.marketAddress] = {
          impliedApy: summary.details.impliedApy ?? 0,
          underlyingApy: summary.details.underlyingApy,
          tvl,
          formattedTvl:
            tvl !== undefined
              ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : undefined
        };
      });
      return map;
    },
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
