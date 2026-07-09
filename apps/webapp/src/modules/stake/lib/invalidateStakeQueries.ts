import type { QueryClient } from '@tanstack/react-query';

// Subgraph-backed queries (positions table rows, activity) vs wagmi's
// on-chain read caches. Allowances / urn state key under 'readContract';
// batched reads (claimables, wallet balances, live total debt) under
// 'readContracts' (plural, a separate key the singular prefix does not
// match); the drip simulation has its own key.
const SUBGRAPH_KEYS = [['stake-user-positions'], ['stake-history']] as const;
const ONCHAIN_KEYS = [['readContract'], ['readContracts'], ['simulateDrip']] as const;

// The indexer trails the chain by a few blocks, so the refetch fired at
// tx-success can land BEFORE the mutation is indexed and re-cache the
// pre-tx rows (PR #1710 review: withdraw+borrow left the positions table
// stale while the on-chain figures refreshed). Converge by re-invalidating
// the subgraph keys on a short trail.
const SUBGRAPH_TRAIL_MS = [5_000, 15_000] as const;

/**
 * The one post-tx invalidation set for every stake mutation (open, manage,
 * claim, recovery) — on-chain reads refetch once, subgraph queries refetch
 * now and again along the trail to outwait indexer lag. The trailing timers
 * hang off the app-lifetime QueryClient, so they are safe across unmounts
 * and are deduped by react-query if nothing changed.
 */
export function invalidateStakeQueries(queryClient: QueryClient) {
  for (const queryKey of [...SUBGRAPH_KEYS, ...ONCHAIN_KEYS]) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
  for (const delay of SUBGRAPH_TRAIL_MS) {
    setTimeout(() => {
      for (const queryKey of SUBGRAPH_KEYS) {
        queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }, delay);
  }
}
