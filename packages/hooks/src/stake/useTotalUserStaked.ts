import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

async function fetchTotalUserStaked(urlSubgraph: string, chainId: number, address: string): Promise<bigint> {
  const query = gql`
    {
      stakingUrns: StakingUrn(where: { owner: { _ilike: "${address}" }, chainId: { _eq: ${chainId} } }) {
        skyLocked
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as { stakingUrns: { skyLocked: string }[] };

  if (!response.stakingUrns || response.stakingUrns.length === 0) {
    return 0n;
  }

  return response.stakingUrns.reduce((acum, urn) => {
    return acum + BigInt(urn.skyLocked);
  }, 0n);
}

export function useTotalUserStaked({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data?: bigint } {
  const { address } = useConnection();
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && address),
    queryKey: ['user-total-staked', urlSubgraph, address, chainId],
    queryFn: () => fetchTotalUserStaked(urlSubgraph, chainId, address!)
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
