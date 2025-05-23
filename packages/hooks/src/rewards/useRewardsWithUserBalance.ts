import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { formatBaLabsUrl } from '../helpers';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';

type RewardsDataResponse = {
  balance: string;
  reward_balance: string;
};

type RewardWithUserBalance = {
  rewardContract: `0x${string}`;
  userHasBalance: boolean;
};

async function fetchRewardsData(
  baseUrl: string,
  contractAddresses: `0x${string}`[],
  address: `0x${string}`
): Promise<RewardWithUserBalance[]> {
  const responses = await Promise.all(
    contractAddresses.map(async contractAddress => {
      const url = formatBaLabsUrl(
        new URL(`${baseUrl}/farms/${contractAddress.toLowerCase()}/wallets/${address.toLowerCase()}`)
      );
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data: RewardsDataResponse = await res.json();

      return {
        rewardContract: contractAddress,
        userHasBalance: parseFloat(data.balance) > 0 || parseFloat(data.reward_balance) > 0
      };
    })
  );

  return responses;
}

export const useRewardsWithUserBalance = ({
  contractAddresses,
  address,
  chainId
}: {
  contractAddresses: `0x${string}`[];
  address?: `0x${string}`;
  chainId: number;
}): ReadHook & { data?: RewardWithUserBalance[] } => {
  const baseUrl = getBaLabsApiUrl(chainId);

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery<RewardWithUserBalance[] | undefined>({
    enabled: Boolean(baseUrl && contractAddresses && address),
    queryKey: ['rewards-with-user-balance', contractAddresses, address, chainId],
    queryFn: () =>
      baseUrl ? fetchRewardsData(baseUrl, contractAddresses, address!) : Promise.resolve(undefined)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'BA Labs API',
        href: baseUrl || 'https://blockanalitica.com/',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
};
