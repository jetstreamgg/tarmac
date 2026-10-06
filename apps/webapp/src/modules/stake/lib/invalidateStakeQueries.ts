import type { QueryClient } from '@tanstack/react-query';
import { STAKE_URN_VAULTS_KEY } from '../hooks/useStakeUrnVaults';

// wagmi's on-chain read caches. Allowances / urn state key under
// 'readContract'; batched reads (claimables, wallet balances, live total debt)
// under 'readContracts' (plural, a separate key the singular prefix does not
// match); the drip simulation has its own key. The indexer-backed reads —
// 'stake-user-positions' (barks) and 'stake-history' (activity) — are not
// listed: every confirmed transaction refetches them once the indexer has
// processed the transaction's block (refreshHistoryAfterTx).
const ONCHAIN_KEYS = [[STAKE_URN_VAULTS_KEY], ['readContract'], ['readContracts'], ['simulateDrip']] as const;

// The positions list is an on-chain read, but the receipt being in does not
// mean every RPC node has the block: a load-balanced node can still answer
// `ownerUrnsCount` from the previous block, and a freshly opened urn would
// then wait for the next unrelated refetch to appear. Re-read it on a short
// trail.
const URN_VAULTS_TRAIL_MS = [5_000, 15_000] as const;

/**
 * The one post-tx invalidation set for every stake mutation (open, manage,
 * claim, recovery) — on-chain reads refetch once, the urn list again along the
 * trail to outwait RPC lag. The trailing timers hang off the app-lifetime
 * QueryClient, so they are safe across unmounts and are deduped by react-query
 * if nothing changed.
 */
export function invalidateStakeQueries(queryClient: QueryClient) {
  for (const queryKey of ONCHAIN_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
  for (const delay of URN_VAULTS_TRAIL_MS) {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: [STAKE_URN_VAULTS_KEY] });
    }, delay);
  }
}
