import type { Query, QueryClient } from '@tanstack/react-query';
import { EXTERNAL_HISTORY_META, INDEXER_HISTORY_META } from '@/hooks/constants';
import { getIndexerUrl } from '@/hooks/helpers/getIndexerUrl';

type HistoryKind = (typeof INDEXER_HISTORY_META)['history'] | (typeof EXTERNAL_HISTORY_META)['history'];

/** How long to wait for the indexer to reach the transaction's block before refreshing anyway. */
export const INDEXER_WAIT_MS = 60_000;
export const INDEXER_POLL_MS = 1_500;
const INDEXER_REQUEST_TIMEOUT_MS = 5_000;
/**
 * Extra refreshes of third-party history (Morpho, Pendle) after the indexer
 * one: their APIs lag on their own schedule, which the indexer height says
 * nothing about (Pendle's PnL feed takes ~20s).
 */
export const EXTERNAL_FOLLOW_UPS_MS = [15_000, 45_000] as const;
/** Fixed refreshes for a success reported without a receipt block. */
export const NO_BLOCK_REFRESHES_MS = [0, 5_000, 15_000] as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isHistory = (kind?: HistoryKind) => (query: Query) =>
  kind ? query.meta?.history === kind : query.meta?.history !== undefined;

/**
 * Refetches mounted history queries without cancelling one already in flight
 * — a user's "load more" page fetch would otherwise be dropped. Not awaited:
 * a hung request must not hold up the next refresh.
 */
function refetchHistory(queryClient: QueryClient, kind?: HistoryKind) {
  void queryClient.invalidateQueries({ predicate: isHistory(kind) }, { cancelRefetch: false });
}

/** The last block the Sky indexer has processed for `chainId`, or undefined when unreachable. */
async function indexerProgressBlock(chainId: number): Promise<bigint | undefined> {
  try {
    const response = await fetch(getIndexerUrl(chainId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `{ _meta(where: { chainId: { _eq: ${chainId} } }) { progressBlock } }` }),
      signal: AbortSignal.timeout(INDEXER_REQUEST_TIMEOUT_MS)
    });
    const progressBlock = (await response.json())?.data?._meta?.[0]?.progressBlock;
    return progressBlock === undefined || progressBlock === null ? undefined : BigInt(progressBlock);
  } catch {
    return undefined;
  }
}

async function waitForIndexer(chainId: number, blockNumber: bigint) {
  const deadline = Date.now() + INDEXER_WAIT_MS;
  while (Date.now() < deadline) {
    const progressBlock = await indexerProgressBlock(chainId);
    if (progressBlock !== undefined && progressBlock >= blockNumber) return;
    await sleep(INDEXER_POLL_MS);
  }
}

/**
 * Brings the history tables up to date with a just-confirmed transaction. The
 * indexer trails the receipt by a few seconds (far longer when it falls
 * behind), so a refetch at success would re-cache the pre-tx rows: instead
 * wait until the indexer's progress block reaches the receipt's block, then
 * refetch every history query once.
 *
 * History is marked stale up front, so a table mounted during the wait fetches
 * on mount and is then refetched with the rest.
 */
export async function refreshHistoryAfterTx(
  queryClient: QueryClient,
  { chainId, blockNumber }: { chainId: number; blockNumber?: bigint }
) {
  void queryClient.invalidateQueries({ predicate: isHistory(), refetchType: 'none' });

  if (blockNumber === undefined) {
    let elapsed = 0;
    for (const at of NO_BLOCK_REFRESHES_MS) {
      await sleep(at - elapsed);
      elapsed = at;
      refetchHistory(queryClient);
    }
  } else {
    await waitForIndexer(chainId, blockNumber);
    refetchHistory(queryClient);
  }

  let elapsed = 0;
  for (const at of EXTERNAL_FOLLOW_UPS_MS) {
    await sleep(at - elapsed);
    elapsed = at;
    refetchHistory(queryClient, EXTERNAL_HISTORY_META.history);
  }
}
