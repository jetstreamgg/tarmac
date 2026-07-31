import { request, gql } from 'graphql-request';
import { RewardContract, RewardContractInfo, RewardContractInfoRaw } from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';

async function fetchRewardContractsInfo(
  urlIndexer: string,
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

  const response = (await request(urlIndexer, query)) as any;

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
  indexerUrl,
  chainId,
  rewardContracts
}: {
  indexerUrl?: string;
  chainId: number;
  rewardContracts: RewardContract[];
}): ReadHook & { data?: RewardContractInfo[] } {
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && rewardContracts.length > 0),
    queryKey: ['reward-contracts-info', urlIndexer, rewardContracts, chainId],
    queryFn: () => fetchRewardContractsInfo(urlIndexer, rewardContracts, chainId)
  });

  return {
    isLoading,
    data,
    error,
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
