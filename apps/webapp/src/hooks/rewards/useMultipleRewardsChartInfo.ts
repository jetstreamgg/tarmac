import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';

import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';

type RewardsChartInfo = {
  apr: string;
  cRate: string;
  date: string;
  depositors: number;
  price: string;
  staked_volume: string;
  total_farmed: string;
  total_staked: string;
  withdraw_volume: string;
};

export type RewardsChartInfoParsed = {
  blockTimestamp: number;
  price: string;
  suppliers: number;
  suppliedVolume: string;
  totalRewarded: string;
  totalSupplied: string;
  withdrawVolume: string;
  rate: string;
};

function transformBaLabsChartData(results: RewardsChartInfo[]): RewardsChartInfoParsed[] {
  const parsed = results.map((item: RewardsChartInfo) => {
    return {
      blockTimestamp: new Date(item.date).getTime() / 1000,
      price: item.price,
      suppliers: item.depositors,
      suppliedVolume: item.staked_volume,
      totalRewarded: item.total_farmed,
      totalSupplied: item.total_staked,
      withdrawVolume: item.withdraw_volume,
      rate: item.apr
    };
  });
  return parsed;
}

async function fetchRewardsChartInfo(urls: URL[]): Promise<RewardsChartInfoParsed[][]> {
  // Each farm is fetched independently (and paged — the endpoint caps a response
  // at 1000 rows whatever p_size asks for) so one farm's failure leaves the
  // others' series intact.
  const settled = await Promise.allSettled(urls.map(url => fetchBaLabsPages<RewardsChartInfo>(url)));

  return settled.map((result, index) => {
    if (result.status !== 'fulfilled') {
      console.warn('Failed to fetch BaLabs data', { url: urls[index]?.href, error: result.reason });
      return [];
    }
    return transformBaLabsChartData(result.value);
  });
}

export function useMultipleRewardsChartInfo({
  rewardContractAddresses,
  limit = 100
}: {
  rewardContractAddresses: string[];
  limit?: number;
}): ReadHook & { data?: RewardsChartInfoParsed[][] } {
  const baseUrl = getBaLabsApiUrl();
  const urls: URL[] = [];
  if (baseUrl && rewardContractAddresses.length > 0) {
    rewardContractAddresses.forEach(rewardContractAddress => {
      const endpoint = `${baseUrl}/farms/${rewardContractAddress.toLowerCase()}/historic/?p_size=${limit}`;
      urls.push(formatBaLabsUrl(new URL(endpoint)));
    });
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(rewardContractAddresses.length > 0 && baseUrl),
    queryKey: ['reward-charts', urls],
    queryFn: () => (urls.length > 0 ? fetchRewardsChartInfo(urls) : Promise.resolve([]))
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: urls.map(url => ({
      title: 'BA Labs API',
      href: url?.href || 'https://blockanalitica.com/',
      onChain: false,
      trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
    }))
  };
}
