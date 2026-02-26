import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';

async function fetchTotalSavingsSuppliers(urlSubgraph: string): Promise<number> {
  const query = gql`
    {
      savingsSuppliers {
        id
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;
  const numSuppliers = response?.savingsSuppliers?.length ?? 0;
  return numSuppliers;
}

export function useTotalSavingsSuppliers({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data?: number } {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl() || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['total-savings-suppliers', urlSubgraph],
    queryFn: () => fetchTotalSavingsSuppliers(urlSubgraph)
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
