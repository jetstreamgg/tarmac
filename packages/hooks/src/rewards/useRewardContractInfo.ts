import { request, gql } from 'graphql-request';
import { RewardContractChangeRaw, RewardContractInfo, RewardContractInfoRaw } from './rewards';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';

// Mock contract address for SKY-SKY demo reward
const MOCK_SKY_SKY_REWARD_CONTRACT = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc';

async function fetchRewardContractInfo(
  urlSubgraph: string,
  rewardContractId: string
): Promise<RewardContractInfo | null> {
  const query = gql`
    {
        reward(id:"${rewardContractId}"){
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

  const reward = response.reward as RewardContractInfoRaw;

  if (!reward) {
    return {
      totalSupplied: BigInt(0),
      totalRewardsClaimed: BigInt(0),
      supplyInstances: [],
      withdrawals: [],
      rewardClaims: [],
      tvl: [],
      suppliers: []
    };
  }

  return {
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
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  // Return mock data for demo SKY-SKY contract
  if (rewardContractAddress.toLowerCase() === MOCK_SKY_SKY_REWARD_CONTRACT.toLowerCase()) {
    return {
      data: {
        totalSupplied: BigInt('1000000000000000000000000'), // 1M SKY
        totalRewardsClaimed: BigInt('50000000000000000000000'), // 50k SKY
        supplyInstances: [],
        withdrawals: [],
        rewardClaims: [],
        tvl: [],
        suppliers: []
      },
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

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && rewardContractAddress),
    queryKey: ['reward-contract-info', urlSubgraph, rewardContractAddress],
    queryFn: () => fetchRewardContractInfo(urlSubgraph, rewardContractAddress)
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
