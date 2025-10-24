import request, { gql } from 'graphql-request';
import { useChainId } from 'wagmi';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';

// Mock contract address for SKY-SKY demo reward
const MOCK_SKY_SKY_REWARD_CONTRACT = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc' as `0x${string}`;

async function fetchStakeRewardContracts(urlSubgraph: string) {
  const query = gql`
    {
      rewards(where: { stakingEngineActive: true }) {
        id
      }
    }
  `;

  const response = await request<{ rewards: { id: `0x${string}` }[] }>(urlSubgraph, query);
  const parsedRewardContracts = response.rewards;
  if (!parsedRewardContracts) {
    return [];
  }

  const contracts = parsedRewardContracts.map(f => ({
    contractAddress: f.id
  }));

  // Add mock SKY-SKY reward contract for demo purposes
  contracts.push({
    contractAddress: MOCK_SKY_SKY_REWARD_CONTRACT
  });

  return contracts;
}

export function useStakeRewardContracts({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data: { contractAddress: `0x${string}` }[] | undefined } {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['stakeRewardContracts', urlSubgraph],
    queryFn: () => fetchStakeRewardContracts(urlSubgraph),
    enabled: !!urlSubgraph
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
