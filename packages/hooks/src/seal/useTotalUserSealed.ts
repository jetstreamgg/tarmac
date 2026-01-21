import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';

async function fetchTotalUserSealed(urlSubgraph: string, address: string): Promise<bigint> {
  const query = gql`
    {
      sealUrns(where: {owner: "${address}"}) {
        mkrLocked
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as { sealUrns: { mkrLocked: string }[] };

  if (!response.sealUrns || response.sealUrns.length === 0) {
    return 0n;
  }

  return response.sealUrns.reduce((acum, urn) => {
    return acum + BigInt(urn.mkrLocked);
  }, 0n);
}

export function useTotalUserSealed({
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
    queryKey: ['user-total-sealed', urlSubgraph, address],
    queryFn: () => fetchTotalUserSealed(urlSubgraph, address!)
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
