import { request, gql } from 'graphql-request';
import {
  RewardContract,
  RewardContractChangeRaw,
  RewardContractInfo,
  RewardContractInfoRaw
} from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';

async function fetchRewardContractsInfo(
  urlSubgraph: string,
  rewardContracts: RewardContract[]
): Promise<RewardContractInfo[] | undefined> {
  const rewardContractAddress = rewardContracts.map(f => `"${f.contractAddress}"`);
  const query = gql`
  {
    rewards(where: {id_in: [${rewardContractAddress}]}) {
      id
      totalSupplied,
      totalRewardsClaimed
      supplyInstances {
        id
        blockTimestamp,
        transactionHash
        amount
      }
      withdrawals  {
        id
        blockTimestamp,
        transactionHash
        amount
      }
      rewardClaims {
        id
        amount
        transactionHash
        blockTimestamp
      }
      tvl {
        id
        amount
        transactionHash
        blockTimestamp
      }
      suppliers {
        user
      }
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
    totalRewardsClaimed: BigInt(reward.totalRewardsClaimed),
    supplyInstances: reward.supplyInstances.map((d: RewardContractChangeRaw) => ({
      id: d.id,
      blockTimestamp: parseInt(d.blockTimestamp, 10),
      transactionHash: d.transactionHash,
      amount: BigInt(d.amount)
    })),
    withdrawals: reward.withdrawals.map((d: RewardContractChangeRaw) => ({
      id: d.id,
      blockTimestamp: parseInt(d.blockTimestamp, 10),
      transactionHash: d.transactionHash,
      amount: BigInt(d.amount)
    })),
    rewardClaims: reward.rewardClaims.map((d: RewardContractChangeRaw) => ({
      id: d.id,
      amount: BigInt(d.amount),
      transactionHash: d.transactionHash,
      blockTimestamp: parseInt(d.blockTimestamp, 10)
    })),
    tvl: reward.tvl.map((d: RewardContractChangeRaw) => ({
      id: d.id,
      amount: BigInt(d.amount),
      transactionHash: d.transactionHash,
      blockTimestamp: parseInt(d.blockTimestamp, 10)
    })),
    suppliers: reward.suppliers.reduce((acc: { user: string }[], d: any) => {
      const userLower = d.user.toLowerCase();
      if (!acc.some(accUser => accUser.user.toLowerCase() === userLower)) {
        acc.push({ user: d.user });
      }
      return acc;
    }, [])
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
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && rewardContracts.length > 0),
    queryKey: ['reward-contracts-info', urlSubgraph, rewardContracts],
    queryFn: () => fetchRewardContractsInfo(urlSubgraph, rewardContracts)
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
