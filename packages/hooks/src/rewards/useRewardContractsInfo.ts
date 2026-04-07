import { request, gql } from 'graphql-request';
import { RewardContract, RewardContractInfo, RewardContractInfoRaw } from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';

async function fetchRewardContractsInfo(
  urlSubgraph: string,
  rewardContracts: RewardContract[],
  chainId: number
): Promise<RewardContractInfo[] | undefined> {
  const rewardContractAddresses = rewardContracts.map(f => `"${chainId}-${f.contractAddress.toLowerCase()}"`);
  const query = gql`
    {
      rewards: Reward(where: { id: { _in: [${rewardContractAddresses}] }, chainId: { _eq: ${chainId} } }) {
        id
        totalSupplied
        totalRewardsClaimed
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;

  const parsedRewards = response.rewards as RewardContractInfoRaw[];
  if (!parsedRewards) {
    return undefined;
  }

  return parsedRewards.map(reward => ({
    totalSupplied: BigInt(reward.totalSupplied),
    totalRewardsClaimed: BigInt(reward.totalRewardsClaimed)
  }));
}

export function useRewardContractsInfo({
  subgraphUrl,
  chainId,
  rewardContracts
}: {
  subgraphUrl?: string;
  chainId: number;
  rewardContracts: RewardContract[];
}): ReadHook & { data?: RewardContractInfo[] } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && rewardContracts.length > 0),
    queryKey: ['reward-contracts-info', urlSubgraph, rewardContracts, chainId],
    queryFn: () => fetchRewardContractsInfo(urlSubgraph, rewardContracts, chainId)
  });

  return {
    isLoading,
    data,
    error,
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
