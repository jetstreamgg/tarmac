import { request, gql } from 'graphql-request';
import { RewardContractInfo, RewardContractInfoRaw } from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';

async function fetchRewardContractInfo(
  urlIndexer: string,
  rewardContractId: string,
  chainId: number
): Promise<RewardContractInfo | null> {
  const query = gql`
    {
      reward: Reward_by_pk(id: "${chainId}-${rewardContractId.toLowerCase()}") {
        totalSupplied
        totalRewardsClaimed
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as any;

  const reward = response.reward as RewardContractInfoRaw;

  if (!reward) {
    return {
      totalSupplied: BigInt(0),
      totalRewardsClaimed: BigInt(0)
    };
  }

  return {
    totalSupplied: BigInt(reward.totalSupplied),
    totalRewardsClaimed: BigInt(reward.totalRewardsClaimed)
  };
}

export function useRewardContractInfo({
  indexerUrl,
  chainId,
  rewardContractAddress
}: {
  indexerUrl?: string;
  chainId: number;
  rewardContractAddress: string;
}): ReadHook & { data?: RewardContractInfo | null } {
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && rewardContractAddress),
    queryKey: ['reward-contract-info', urlIndexer, rewardContractAddress, chainId],
    queryFn: () => fetchRewardContractInfo(urlIndexer, rewardContractAddress, chainId)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem indexer',
        href: urlIndexer,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
