import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { formatBaLabsUrl } from '../helpers';

// Mock contract address for SKY-SKY demo reward
const MOCK_SKY_SKY_REWARD_CONTRACT = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc';

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

async function fetchRewardsChartInfo(url: URL): Promise<RewardsChartInfoParsed[]> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data: { results: RewardsChartInfo[] } = await response.json();

    const result = transformBaLabsChartData(data?.results || []);

    return result;
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useRewardsChartInfo({
  rewardContractAddress,
  limit = 100
}: {
  rewardContractAddress: string;
  limit?: number;
}): ReadHook & { data?: RewardsChartInfoParsed[] } {
  const chainId = useChainId();
  const baseUrl = getBaLabsApiUrl(chainId);

  // Return mock data for demo SKY-SKY contract
  if (rewardContractAddress.toLowerCase() === MOCK_SKY_SKY_REWARD_CONTRACT.toLowerCase()) {
    const now = Date.now() / 1000;
    return {
      data: [
        {
          blockTimestamp: now,
          price: '0.05',
          suppliers: 42,
          suppliedVolume: '100000',
          totalRewarded: '5000',
          totalSupplied: '1000000',
          withdrawVolume: '50000',
          rate: '0.125' // 12.5% rate
        }
      ],
      isLoading: false,
      error: null as any,
      mutate: () => Promise.resolve({} as any),
      dataSources: [
        {
          title: 'Mock SKY-SKY Reward Contract (Demo)',
          href: '',
          onChain: false,
          trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
        }
      ]
    };
  }

  let url: URL | undefined;
  if (baseUrl && rewardContractAddress) {
    const endpoint = `${baseUrl}/farms/${rewardContractAddress.toLowerCase()}/historic/?p_size=${limit}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(rewardContractAddress && baseUrl),
    queryKey: ['reward-chart', url],
    queryFn: () => (url ? fetchRewardsChartInfo(url) : Promise.resolve([]))
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'BA Labs API',
        href: url?.href || 'https://blockanalitica.com/',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
