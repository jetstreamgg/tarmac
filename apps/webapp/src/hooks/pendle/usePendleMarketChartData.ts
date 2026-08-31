import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { PENDLE_API_BASE_URL } from './constants';

/**
 * One point of the market's daily historical series (E1 detail chart).
 * `impliedApy` is the Fixed APY headline rate as a decimal fraction.
 */
export type PendleMarketChartPoint = {
  /** Bucket timestamp in unix seconds */
  timestampSec: number;
  /**
   * Implied (fixed) APY, decimal (0.045 = 4.5%). Undefined for a bucket the
   * API serves without one — never zero-filled, since consumers average this
   * series and a filled 0 would silently deflate the mean.
   */
  impliedApy?: number;
  /** Underlying APY, decimal */
  underlyingApy?: number;
  /**
   * Pool liquidity in USD. Pendle serves this as `tvl` on /historical-data, but
   * it is the AMM pool's liquidity (matches `details.liquidity` on /markets/all),
   * not the market's total TVL (`details.totalTvl`) - APP-526 item 6.1. Kept
   * mapped but unplotted: APP-527 pulled the Liquidity series from the chart.
   */
  liquidity?: number;
};

export type PendleMarketChartDataHook = ReadHook & {
  data?: PendleMarketChartPoint[];
};

type HistoricalDataResponseRaw = {
  total: number;
  results: Array<{
    timestamp: string;
    impliedApy?: number;
    underlyingApy?: number;
    tvl?: number;
  }>;
};

/**
 * GET /v2/{chainId}/markets/{address}/historical-data?time_frame=day
 *
 * Daily series for the detail chart. The endpoint returns the whole
 * market lifetime at the chosen bucket size — markets live for months, so the
 * daily series stays small and timeframe filtering happens client-side. Our
 * integration is mainnet-only (Pendle's API doesn't serve forks), matching
 * usePendleMarketsApiData.
 */
export async function fetchPendleMarketHistoricalData(
  marketAddress: `0x${string}`
): Promise<PendleMarketChartPoint[]> {
  const url = `${PENDLE_API_BASE_URL}/v2/${mainnet.id}/markets/${marketAddress}/historical-data?time_frame=day`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pendle /historical-data ${response.status}`);
  }
  const json = (await response.json()) as HistoricalDataResponseRaw;
  return (json.results ?? [])
    .map(row => ({
      timestampSec: Math.floor(Date.parse(row.timestamp) / 1000),
      impliedApy: row.impliedApy,
      underlyingApy: row.underlyingApy,
      liquidity: row.tvl
    }))
    .filter(point => Number.isFinite(point.timestampSec))
    .sort((a, b) => a.timestampSec - b.timestampSec);
}

/** Daily rate history for one market, for the detail chart. */
export function usePendleMarketChartData(
  marketAddress: `0x${string}` | undefined
): PendleMarketChartDataHook {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendle-market-historical-data', marketAddress],
    enabled: !!marketAddress,
    queryFn: () => fetchPendleMarketHistoricalData(marketAddress!),
    staleTime: 5 * 60_000,
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
