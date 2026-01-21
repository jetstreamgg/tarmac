import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

async function fetchTotalUserStaked(urlSubgraph: string, address: string): Promise<bigint> {
  // TODO: Update this query once the subgraph is updated
  const query = gql`
    {
      stakingUrns(where: {owner: "${address}"}) {
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
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && address),
    queryKey: ['user-total-staked', urlSubgraph, address],
    queryFn: () => fetchTotalUserStaked(urlSubgraph, address!)
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
