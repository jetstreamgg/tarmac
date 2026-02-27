import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { DelegateInfo, DelegateRaw } from './delegate';
import { parseDelegatesFn } from './utils';
import { useDelegateMetadataMapping } from './useDelegateMetadataMapping';
import { stripChainIdPrefix } from '../helpers';

async function fetchUserDelegates(
  urlSubgraph: string,
  chainId: number,
  user: `0x${string}`,
  search?: string,
  version?: 1 | 2 | 3
): Promise<DelegateInfo[] | undefined> {
  const whereConditions = [
    `{ chainId: { _eq: ${chainId} } }`,
    `{ delegations: { delegator: { _ilike: "%${user}%" }, amount: { _gt: "0" } } }`
  ];
  if (version) whereConditions.push(`{ version: { _eq: "${version}" } }`);
  if (search) {
    whereConditions.push(`{ id: { _ilike: "%${search}%" } }`);
  }
  const whereClause = `where: { _and: [${whereConditions.join(', ')}] }`;

  const query = gql`
    {
      delegates: Delegate(
        ${whereClause}
      ) {
        id
        blockTimestamp
        ownerAddress
        delegators
        delegations(
          limit: 1000
          where: { delegator: { _nin: ["0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3", "0xb1fc11f03b084fff8dae95fa08e8d69ad2547ec1"] } }
        ) {
          id
          delegator
          amount
          timestamp
        }
      }
    }
  `;

  const response = await request<{ delegates: DelegateRaw[] }>(urlSubgraph, query);
  const parsedDelegates = response.delegates.map(d => ({
    ...d,
    id: stripChainIdPrefix(d.id) as `0x${string}`,
    totalDelegated: d.delegations.reduce((acc, curr) => acc + BigInt(curr.amount), BigInt(0)).toString()
  }));
  if (!parsedDelegates) {
    return undefined;
  }

  const delegates = parsedDelegates.map(parseDelegatesFn);

  return delegates.sort((a, b) => {
    // It should only be one delegation object for the user
    const amountA =
      a.delegations.find(d => d.delegator.toLowerCase() === user.toLowerCase())?.amount || BigInt(0);
    const amountB =
      b.delegations.find(d => d.delegator.toLowerCase() === user.toLowerCase())?.amount || BigInt(0);

    // Sort in descending order
    if (amountA > amountB) return -1;
    if (amountA < amountB) return 1;
    return 0;
  });
}

export function useUserDelegates({
  subgraphUrl,
  chainId,
  user,
  search,
  version
}: {
  subgraphUrl?: string;
  chainId: number;
  user: `0x${string}`;
  search?: string;
  version?: 1 | 2 | 3;
}): ReadHook & { data?: DelegateInfo[] } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';

  const {
    data: subgraphDelegates,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && user.length > 0 && user !== ZERO_ADDRESS),
    queryKey: ['user-delegates', urlSubgraph, chainId, user, search, version],
    queryFn: () => fetchUserDelegates(urlSubgraph, chainId, user, search, version)
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
