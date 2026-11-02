import type { Query, QueryClient } from '@tanstack/react-query';
import { ALLOWANCE_META } from '@/hooks/constants';

/** One mainnet block: the proxy RPC can trail the node that reported the receipt. */
export const ALLOWANCE_FOLLOW_UP_MS = 12_000;

const predicate = (query: Query) => query.meta?.allowance === ALLOWANCE_META.allowance;

function refresh(queryClient: QueryClient) {
  // Cleared, not just marked stale: a stale read still hands its old value to the next launch.
  void queryClient.resetQueries({ predicate, type: 'inactive' });
  void queryClient.refetchQueries({ predicate, type: 'active' });
}

/**
 * A spent approval must not survive in the 30s-stale allowance reads: the next
 * launch would drop its approve and the spend would revert (APP-675).
 */
export function refreshAllowancesAfterTx(queryClient: QueryClient) {
  refresh(queryClient);
  setTimeout(() => refresh(queryClient), ALLOWANCE_FOLLOW_UP_MS);
}
