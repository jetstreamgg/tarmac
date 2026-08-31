import { DelegateInfo, DelegateRaw } from './delegate';

/**
 * Delegates whose governance-portal name matches the search text. Names exist
 * only in the vote.sky.money metadata (the indexer's Delegate table has no
 * name column), so name search resolves to addresses client-side and the
 * indexer query then filters by address — keeping pagination, ordering and
 * the user/rest split server-side.
 */
export function findDelegateNameMatches(
  metadataMapping: Record<string, { name?: string }> | undefined,
  search: string | undefined
): `0x${string}`[] | undefined {
  if (!search || !metadataMapping) return undefined;
  const query = search.toLowerCase();
  const matches = Object.entries(metadataMapping)
    .filter(([, metadata]) => metadata.name?.toLowerCase().includes(query))
    .map(([address]) => address as `0x${string}`);
  return matches.length ? matches : undefined;
}

/**
 * GraphQL condition for the delegate search box: address text match OR one of
 * the name-matched addresses. Per-address `_ilike` (no wildcards) instead of
 * `_in` because the metadata keys are lowercased while `_in` compares
 * case-sensitively against whatever casing the indexer stores.
 */
export function buildDelegateSearchCondition(
  search: string | undefined,
  nameMatches: `0x${string}`[] | undefined
): string | undefined {
  if (!search) return undefined;
  const addressTerm = `{ address: { _ilike: "%${search}%" } }`;
  if (!nameMatches?.length) return addressTerm;
  const nameTerms = nameMatches.map(address => `{ address: { _ilike: "${address}" } }`);
  return `{ _or: [${[addressTerm, ...nameTerms].join(', ')}] }`;
}

export function parseDelegatesFn(delegate: DelegateRaw) {
  return {
    ...delegate,
    totalDelegated: BigInt(delegate.totalDelegated),
    delegations: delegate.delegations?.map(
      delegation =>
        ({
          ...delegation,
          amount: BigInt(delegation.amount)
        }) as any
    )
  } as DelegateInfo;
}
