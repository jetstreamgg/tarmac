import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { formatBaLabsUrl } from '../helpers';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';

type RewardsDataResponse = {
  wallet_address: string;
  balance: string;
  reward_balance: string;
  reward_tokens_per_second: string;
};

type RewardsData = {
  walletAddress: string;
  balance: string;
  rewardBalance: string;
  rewardTokensPerSecond: string;
};

async function fetchRewardsData(url: URL): Promise<RewardsData> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data: RewardsDataResponse = await response.json();

    return {
      walletAddress: data?.wallet_address || '',
      balance: data?.balance || '',
      rewardBalance: data?.reward_balance || '',
      rewardTokensPerSecond: data?.reward_tokens_per_second || ''
    };
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return {
      walletAddress: '',
      balance: '',
      rewardBalance: '',
      rewardTokensPerSecond: ''
    };
  }
}

export const useUserRewardsBalance = ({
  contractAddress,
  address,
  chainId
}: {
  contractAddress?: `0x${string}`;
  address: `0x${string}`;
  chainId: number;
}): ReadHook & { data?: RewardsData } => {
  const baseUrl = getBaLabsApiUrl(chainId) || '';
  let url: URL | undefined;
  if (baseUrl && contractAddress && address) {
    const endpoint = `${baseUrl}/farms/${contractAddress.toLowerCase()}/wallets/${address.toLowerCase()}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery<RewardsData | undefined>({
    enabled: Boolean(baseUrl && contractAddress && address),
    queryKey: ['rewards-data', url],
    queryFn: () => (url ? fetchRewardsData(url) : Promise.resolve(undefined))
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
};
