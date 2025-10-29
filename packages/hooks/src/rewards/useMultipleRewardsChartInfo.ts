import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { formatBaLabsUrl } from '../helpers';

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
  try {
    const responses = await Promise.all(
      urls.map(url =>
        fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
    );

    const parsedResponses: { results: RewardsChartInfo[] }[] = await Promise.all(
      responses.map(response => response.json())
    );

    const result = parsedResponses.map(data => transformBaLabsChartData(data?.results || []));

    return result;
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useMultipleRewardsChartInfo({
  rewardContractAddresses,
  limit = 100
}: {
  rewardContractAddresses: string[];
  limit?: number;
}): ReadHook & { data?: RewardsChartInfoParsed[][] } {
  const chainId = useChainId();
  const baseUrl = getBaLabsApiUrl(chainId);
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
