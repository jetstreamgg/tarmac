import type { Query, QueryClient } from '@tanstack/react-query';

// wagmi keys every contract read as ['readContract', { functionName, ... }].
const isAllowanceRead = (query: Query) => {
  const [scope, params] = query.queryKey as [unknown, { functionName?: unknown } | undefined];
  return scope === 'readContract' && params?.functionName === 'allowance';
};

/**
 * A spent approval must not survive in the 30s-stale allowance reads: the next
 * launch would drop its approve and the spend would revert (APP-675).
 */
export function refreshAllowancesAfterTx(queryClient: QueryClient) {
  return queryClient.resetQueries({ predicate: isAllowanceRead });
}
