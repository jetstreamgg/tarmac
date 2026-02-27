import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { DelegateInfo, DelegateRaw } from './delegate';
import { getRandomItem } from '@jetstreamgg/sky-utils';
import { useMemo } from 'react';
import { parseDelegatesFn } from './utils';
import { useDelegateMetadataMapping } from './useDelegateMetadataMapping';

async function fetchDelegates(
  urlSubgraph: string,
  chainId: number,
  first: number,
  skip: number,
  exclude?: `0x${string}`[],
  orderBy?: string,
  orderDirection?: string,
  search?: string,
  version?: 1 | 2 | 3
): Promise<DelegateInfo[] | undefined> {
  const whereConditions: string[] = [`{ chainId: { _eq: ${chainId} } }`];
  if (version) whereConditions.push(`{ version: { _eq: "${version}" } }`);
  if (exclude?.length)
    whereConditions.push(`{ address: { _nin: [${exclude.map(addr => `"${addr}"`).join(', ')}] } }`);
  if (search) whereConditions.push(`{ address: { _ilike: "%${search}%" } }`);
  const whereClause = `where: { _and: [${whereConditions.join(', ')}] }`;

  const paginationClause = first !== undefined && skip !== undefined ? `limit: ${first}, offset: ${skip}` : '';

  const orderByClause = orderBy && orderDirection ? `order_by: { ${orderBy}: ${orderDirection} }` : '';

  const query = gql`
    {
      delegates: Delegate(${[whereClause, paginationClause, orderByClause].filter(Boolean).join(', ')}) {
        blockTimestamp
        blockNumber
        ownerAddress
        address
        delegators
        delegations(
          limit: 1000
          where: { delegator: { _nin: ["0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3", "0xb1fc11f03b084fff8dae95fa08e8d69ad2547ec1"] } }
        ) {
          amount
        }
      }
    }
  `;

  const response = await request<{ delegates: (DelegateRaw & { address: string })[] }>(urlSubgraph, query);
  const parsedDelegates = response.delegates.map(d => ({
    ...d,
    id: d.address as `0x${string}`,
    totalDelegated: d.delegations.reduce((acc, curr) => acc + BigInt(curr.amount), BigInt(0)).toString()
  })) as DelegateRaw[];
  if (!parsedDelegates) {
    return undefined;
  }

  return parsedDelegates.map(parseDelegatesFn);
}

export function useDelegates({
  subgraphUrl,
  chainId,
  exclude,
  page = 1,
  pageSize = 100,
  random,
  search,
  version,
  enabled = true
}: {
  chainId: number;
  subgraphUrl?: string;
  exclude?: `0x${string}`[];
  page?: number;
  pageSize?: number;
  random?: boolean;
  search?: string;
  version?: 1 | 2 | 3;
  enabled?: boolean;
}): ReadHook & { data?: DelegateInfo[] } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const orderByFields = [
    'blockTimestamp',
    'blockNumber',
    'totalDelegated',
    'ownerAddress',
    'id',
    'delegators'
  ];
  const randomOrderBy = useMemo(() => (random ? getRandomItem(orderByFields) : undefined), [random]);
  const randomOrderDirection = useMemo(() => (random ? getRandomItem(['asc', 'desc']) : undefined), [random]);

  const {
    data: subgraphDelegates,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && enabled),
    queryKey: [
      'delegates',
      urlSubgraph,
      chainId,
      exclude,
      page,
      pageSize,
      random ? randomOrderBy : undefined,
      random ? randomOrderDirection : undefined,
      search,
      version
    ],
    queryFn: () =>
      fetchDelegates(
        urlSubgraph,
        chainId,
        pageSize,
        (page - 1) * pageSize,
        exclude,
        randomOrderBy,
        randomOrderDirection,
        search,
        version
      )
  });

  const { data: metadataMapping } = useDelegateMetadataMapping();
  const data = subgraphDelegates?.map(d => ({
    ...d,
    metadata: metadataMapping?.[d.id] || null
  })) as DelegateInfo[] | undefined;

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
