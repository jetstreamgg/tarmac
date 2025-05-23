import request, { gql } from 'graphql-request';
import { useChainId } from 'wagmi';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';

async function fetchSaRewardContracts(urlSubgraph: string) {
  // TODO do we want to change the property name?
  const query = gql`
    {
      rewards(where: { lockstakeActive: true }) {
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
    contractAddress: f.id
  }));
}

export function useSaRewardContracts({
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
    queryKey: ['saRewardContracts', urlSubgraph],
    queryFn: () => fetchSaRewardContracts(urlSubgraph),
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
