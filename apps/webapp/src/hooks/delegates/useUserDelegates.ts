import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { ZERO_ADDRESS, indexerDataSource } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';
import { DelegateInfo, DelegateRaw } from './delegate';
import { buildDelegateSearchCondition, DelegateWhere, parseDelegatesFn } from './utils';
import { useDelegateMetadataMapping } from './useDelegateMetadataMapping';

async function fetchUserDelegates(
  urlIndexer: string,
  chainId: number,
  user: `0x${string}`,
  search?: string,
  version?: 1 | 2 | 3,
  nameMatches?: `0x${string}`[]
): Promise<DelegateInfo[] | undefined> {
  const delegator = user.toLowerCase();
  const whereConditions: DelegateWhere[] = [
    { chainId: { _eq: chainId } },
    { delegations: { delegator: { _eq: delegator }, amount: { _gt: '0' } } }
  ];
  if (version) whereConditions.push({ version: { _eq: String(version) } });
  const searchCondition = buildDelegateSearchCondition(search, nameMatches);
  if (searchCondition) whereConditions.push(searchCondition);

  const variables = { where: { _and: whereConditions }, delegator };

  const query = gql`
    query UserDelegates($where: Delegate_bool_exp!, $delegator: String!) {
      delegates: Delegate(where: $where) {
        address
        blockTimestamp
        ownerAddress
        delegators
        totalDelegated
        delegations(limit: 1, where: { delegator: { _eq: $delegator } }) {
          id
          delegator
          amount
          timestamp
        }
      }
    }
  `;

  const response = await request<{ delegates: (DelegateRaw & { address: string })[] }>(
    urlIndexer,
    query,
    variables
  );
  const parsedDelegates = response.delegates.map(d => ({
    ...d,
    id: d.address as `0x${string}`
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
  indexerUrl,
  chainId,
  user,
  search,
  version,
  nameMatches
}: {
  indexerUrl?: string;
  chainId: number;
  user: `0x${string}`;
  search?: string;
  version?: 1 | 2 | 3;
  /** Addresses whose metadata name matches `search` — see findDelegateNameMatches. */
  nameMatches?: `0x${string}`[];
}): ReadHook & { data?: DelegateInfo[] } {
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  const {
    data: subgraphDelegates,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && user.length > 0 && user !== ZERO_ADDRESS),
    queryKey: ['user-delegates', urlIndexer, chainId, user, search, version, nameMatches],
    queryFn: () => fetchUserDelegates(urlIndexer, chainId, user, search, version, nameMatches)
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
    dataSources: [indexerDataSource(urlIndexer)]
  };
}
