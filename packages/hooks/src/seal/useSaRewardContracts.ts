import request, { gql } from 'graphql-request';
import { useChainId } from 'wagmi';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { stripChainIdPrefix } from '../helpers';

async function fetchSaRewardContracts(urlSubgraph: string, chainId: number) {
  const query = gql`
    {
      rewards: Reward(where: { lockstakeActive: { _eq: true }, chainId: { _eq: ${chainId} } }) {
        id
      }
    }
  `;

  const response = await request<{ rewards: { id: `0x${string}` }[] }>(urlSubgraph, query);
  const parsedRewardContracts = response.rewards;
  if (!parsedRewardContracts) {
    return undefined;
  }

  return parsedRewardContracts.map(f => ({
    contractAddress: stripChainIdPrefix(f.id) as `0x${string}`
  }));
}

export function useSaRewardContracts({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data: { contractAddress: `0x${string}` }[] | undefined } {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['saRewardContracts', urlSubgraph, chainId],
    queryFn: () => fetchSaRewardContracts(urlSubgraph, chainId),
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
