import { request, gql } from 'graphql-request';
import { RewardContractInfo, RewardContractInfoRaw } from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';

async function fetchRewardContractInfo(
  urlSubgraph: string,
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

  const response = (await request(urlSubgraph, query)) as any;

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
  subgraphUrl,
  chainId,
  rewardContractAddress
}: {
  subgraphUrl?: string;
  chainId: number;
  rewardContractAddress: string;
}): ReadHook & { data?: RewardContractInfo | null } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && rewardContractAddress),
    queryKey: ['reward-contract-info', urlSubgraph, rewardContractAddress, chainId],
    queryFn: () => fetchRewardContractInfo(urlSubgraph, rewardContractAddress, chainId)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
