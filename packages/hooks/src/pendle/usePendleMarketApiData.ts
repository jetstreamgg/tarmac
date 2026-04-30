import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PendleMarketsStatsHook } from './pendle';
import { fetchPendleMarketsByIds } from './pendleApiClient';

/**
 * Hook for fetching headline market stats (implied APY, TVL) from Pendle's API.
 *
 * Our integration only adds mainnet markets to PENDLE_MARKETS, and Pendle's API
 * doesn't serve Tenderly, so we always query mainnet regardless of the
 * connected chain. Display values that aren't easily readable on-chain.
 */
export function usePendleMarketApiData({
  marketAddress
}: {
  marketAddress?: `0x${string}`;
}): PendleMarketsStatsHook {
  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!marketAddress,
    queryKey: ['pendle-market-api', marketAddress?.toLowerCase()],
    queryFn: async () => {
      const results = await fetchPendleMarketsByIds(mainnet.id, [marketAddress!]);
      const summary = results[0];
      if (!summary) return undefined;
      const tvl = summary.details.totalTvl;
      return {
        impliedApy: summary.details.impliedApy ?? 0,
        underlyingApy: summary.details.underlyingApy,
        formattedTvl:
          tvl !== undefined
            ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : undefined
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  return {
    isLoading,
    data,
    error,
    mutate: refetch,
    dataSources: marketAddress
      ? [
          {
            title: 'Pendle Markets API',
            href: 'https://api-v2.pendle.finance/core/docs',
            onChain: false,
            trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
          }
        ]
      : []
  };
}
