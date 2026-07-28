import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';

async function fetchTotalSavingsSuppliers(urlIndexer: string, chainId: number): Promise<number> {
  const query = gql`
    {
      savingsSuppliers: SavingsSupplier(where: { chainId: { _eq: ${chainId} } }) {
        id
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as any;
  const numSuppliers = response?.savingsSuppliers?.length ?? 0;
  return numSuppliers;
}

export function useTotalSavingsSuppliers({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & { data?: number } {
  const chainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer),
    queryKey: ['total-savings-suppliers', urlIndexer, chainId],
    queryFn: () => fetchTotalSavingsSuppliers(urlIndexer, chainId)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
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
