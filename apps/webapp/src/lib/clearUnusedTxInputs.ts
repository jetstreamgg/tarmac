import type { Query, QueryClient } from '@tanstack/react-query';
import { PENDLE_CONVERT_QUERY_KEY } from '@/hooks/pendle/useQuotePendleConvert';
import { SIMULATE_BATCH_QUERY_KEY } from '@/hooks/shared/useSimulateBatch';

const TX_INPUT_READS = new Set(['allowance', 'get_dy', 'get_dx']);

// Allowances decide whether an approve is built, dry runs gate Confirm, and quotes
// set minOut: a launch must not start from a cached copy of any of them (APP-675).
const isTxInput = (query: Query) => {
  const [scope, params] = query.queryKey as [unknown, { functionName?: unknown } | undefined];
  if (scope === 'readContract') return TX_INPUT_READS.has(params?.functionName as string);
  return (
    scope === 'simulateContract' || scope === SIMULATE_BATCH_QUERY_KEY || scope === PENDLE_CONVERT_QUERY_KEY
  );
};

/**
 * Drops the cached transaction inputs nothing is showing, so a flow mounting for
 * this launch reads them fresh. Mounted reads are left alone: they belong to a
 * page-hosted engine or the page behind, and refresh themselves.
 */
export function clearUnusedTxInputs(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: isTxInput, type: 'inactive' });
}
