import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';

const PAGE_SIZE = 1000;

async function fetchAllStUsdsSupplierAddresses(urlSubgraph: string): Promise<string[]> {
  const allOwners = new Set<string>();
  let skip = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const query = gql`
      {
        stusdsDeposits(first: ${PAGE_SIZE}, skip: ${skip}, orderBy: blockTimestamp) {
          owner
        }
      }
    `;

    const response = (await request(urlSubgraph, query)) as { stusdsDeposits?: { owner: string }[] };
    const deposits = response?.stusdsDeposits || [];

    deposits.forEach(d => allOwners.add(d.owner.toLowerCase()));
    skip += PAGE_SIZE;
    hasMorePages = deposits.length === PAGE_SIZE;
  }

  return Array.from(allOwners);
}

export type StUsdsSupplierAddressesHook = ReadHook & {
  data?: string[];
};

export function useStUsdsSupplierAddresses({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): StUsdsSupplierAddressesHook {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['stusds-supplier-addresses', urlSubgraph],
    queryFn: () => fetchAllStUsdsSupplierAddresses(urlSubgraph),
    staleTime: 10 * 60 * 1000, // 10 minutes - supplier lists don't change rapidly
    gcTime: 15 * 60 * 1000 // 15 minutes
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
