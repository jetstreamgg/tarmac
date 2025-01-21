import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { formatBaLabsUrl } from '../helpers';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';

type ApiSealRewardsData = {
  address: string;
  total_staked: string;
  total_farmed: string;
  tokens_per_second: string;
  apy: string;
  depositors: number;
  price: string;
  rewards_token_address: string;
  rewards_token_symbol: string;
};

type SealRewardsData = {
  address: `0x${string}`;
  totalSupplied: number;
  totalRewarded: number;
  tokensPerSecond: number;
  rate: number;
  depositors: number;
  price: number;
  rewardsTokenAddress: `0x${string}`;
  rewardsTokenSymbol: string;
};

const fetchSealRewardsData = async (url: URL): Promise<SealRewardsData[] | undefined> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data: ApiSealRewardsData[] = await response.json();
    return data.map(rewardContract => ({
      address: rewardContract.address as `0x${string}`,
      totalSupplied: parseFloat(rewardContract.total_staked),
      totalRewarded: parseFloat(rewardContract.total_farmed),
      tokensPerSecond: parseFloat(rewardContract.tokens_per_second),
      rate: parseFloat(rewardContract.apy),
      depositors: rewardContract.depositors,
      price: parseFloat(rewardContract.price),
      rewardsTokenAddress: rewardContract.rewards_token_address as `0x${string}`,
      rewardsTokenSymbol: rewardContract.rewards_token_symbol
    }));
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return undefined;
  }
};

export function useSealRewardsData(): ReadHook & { data?: SealRewardsData[] } {
  const chainId = useChainId();

  const baseUrl = getBaLabsApiUrl(chainId) || '';
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/lsefarms/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!url,
    queryKey: ['seal-rewards-data', chainId],
    queryFn: () => (url ? fetchSealRewardsData(url) : Promise.resolve(undefined))
  });

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
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
