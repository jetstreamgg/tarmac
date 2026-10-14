import type { Query, QueryClient } from '@tanstack/react-query';
import { EXTERNAL_HISTORY_META, INDEXER_HISTORY_META } from '@/hooks/constants';
import { getIndexerUrl } from '@/hooks/helpers/getIndexerUrl';
import { getProxyIndexerUrl } from '@/modules/app/hooks/useIndexerUrl';

type HistoryKind = (typeof INDEXER_HISTORY_META)['history'] | (typeof EXTERNAL_HISTORY_META)['history'];

/** How long to wait for the indexer to reach the transaction's block before refreshing anyway. */
export const INDEXER_WAIT_MS = 60_000;
export const INDEXER_POLL_MS = 1_500;
const INDEXER_REQUEST_TIMEOUT_MS = 5_000;
/**
 * Extra refreshes of third-party history (Morpho, Pendle), counted from the
 * receipt: their APIs lag on their own schedule, which the indexer height says
 * nothing about. Pendle's /v1/pnl/transactions exposes a new row ~20s after
 * the block (n=2 against a real wallet, May 2026, both 17.3–21.3s); the first
 * follow-up leaves a margin over that, the second covers outliers.
 */
export const EXTERNAL_FOLLOW_UPS_MS = [25_000, 45_000] as const;
/** Fixed refreshes for a success reported without a receipt block. */
export const NO_BLOCK_REFRESHES_MS = [0, 5_000, 15_000] as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isHistory = (kind?: HistoryKind) => (query: Query) =>
  kind ? query.meta?.history === kind : query.meta?.history !== undefined;

/** Runs `run` once `query` finishes its current fetch, unless it is removed first. */
function afterFetch(queryClient: QueryClient, query: Query, run: () => void) {
  const unsubscribe = queryClient.getQueryCache().subscribe(event => {
    if (event.query !== query) return;
    if (event.type === 'removed') unsubscribe();
    else if (query.state.fetchStatus === 'idle') {
      unsubscribe();
      run();
    }
  });
}

/**
 * Refetches mounted history queries. A fetch already in flight may have left
 * before the transaction was indexed, so joining it would cache the pre-tx
 * rows: it is cancelled and restarted. Two fetches are let finish first
 * instead, since react-query cannot restart them: a first load (there is no
 * data to fall back on while cancelled) and a user's "load more" page fetch.
 * Not awaited: a hung request must not hold up the next refresh.
 */
function refetchHistory(queryClient: QueryClient, kind?: HistoryKind) {
  for (const query of queryClient.getQueryCache().findAll({ predicate: isHistory(kind) })) {
    const refetch = () => void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
    const { fetchStatus, data, fetchMeta } = query.state;
    if (fetchStatus !== 'idle' && (data === undefined || fetchMeta?.fetchMore)) {
      afterFetch(queryClient, query, refetch);
    } else {
      refetch();
    }
  }
}

/**
 * Every indexer the history tables read for `chainId`: the hooks default to
 * the production proxy, while the module tables go through the app's proxy
 * origin, which can be a separate deployment (staging) with its own progress.
 */
const indexerUrls = (chainId: number) => [...new Set([getIndexerUrl(chainId), getProxyIndexerUrl(chainId)])];

/** The last block the indexer at `url` has processed for `chainId`. Throws when it can't say. */
async function indexerProgressBlock(url: string, chainId: number): Promise<bigint> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: `{ _meta(where: { chainId: { _eq: ${chainId} } }) { progressBlock } }` }),
    signal: AbortSignal.timeout(INDEXER_REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body?.errors?.length) throw new Error(body.errors[0]?.message ?? 'GraphQL error');
  const progressBlock = body?.data?._meta?.[0]?.progressBlock;
  if (progressBlock === undefined || progressBlock === null) throw new Error('no progressBlock');
  return BigInt(progressBlock);
}

async function waitForIndexer(chainId: number, blockNumber: bigint) {
  const deadline = Date.now() + INDEXER_WAIT_MS;
  const pending = new Set(indexerUrls(chainId));
  const warned = new Set<string>();
  while (Date.now() < deadline) {
    await Promise.all(
      [...pending].map(async url => {
        try {
          if ((await indexerProgressBlock(url, chainId)) >= blockNumber) pending.delete(url);
        } catch (error) {
          // Once per indexer: the wait then runs to the cap, and a broken
          // progress query would otherwise look like an indexer behind.
          if (warned.has(url)) return;
          warned.add(url);
          console.warn(`History refresh: can't read the indexer progress at ${url}`, error);
        }
      })
    );
    if (pending.size === 0) return;
    await sleep(INDEXER_POLL_MS);
  }
}

async function refreshIndexerHistory(
  queryClient: QueryClient,
  chainId: number,
  blockNumber: bigint | undefined
) {
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
}

async function followUpExternalHistory(queryClient: QueryClient) {
  let elapsed = 0;
  for (const at of EXTERNAL_FOLLOW_UPS_MS) {
    await sleep(at - elapsed);
    elapsed = at;
    refetchHistory(queryClient, EXTERNAL_HISTORY_META.history);
  }
}

// The `chainId:blockNumber` refreshes running per client. An engine can report
// the same success twice (its settle effect re-runs while the receipt is still
// in), and two transactions can land in one block: either way one refresh
// covers both.
const runningRefreshes = new WeakMap<QueryClient, Set<string>>();

/**
 * Brings the history tables up to date with a just-confirmed transaction. The
 * indexer trails the receipt by a few seconds (far longer when it falls
 * behind), so a refetch at success would re-cache the pre-tx rows: instead
 * wait until every indexer the tables read has processed the receipt's block,
 * then refetch every history query once. Third-party history is refetched
 * again on its own schedule.
 *
 * History is marked stale up front, so a table mounted during the wait fetches
 * on mount and is then refetched with the rest.
 */
export async function refreshHistoryAfterTx(
  queryClient: QueryClient,
  { chainId, blockNumber }: { chainId: number; blockNumber?: bigint }
) {
  const key = blockNumber === undefined ? undefined : `${chainId}:${blockNumber}`;
  let running = runningRefreshes.get(queryClient);
  if (!running) runningRefreshes.set(queryClient, (running = new Set()));
  if (key !== undefined) {
    if (running.has(key)) return;
    running.add(key);
  }

  try {
    void queryClient.invalidateQueries({ predicate: isHistory(), refetchType: 'none' });
    await Promise.all([
      refreshIndexerHistory(queryClient, chainId, blockNumber),
      followUpExternalHistory(queryClient)
    ]);
  } finally {
    if (key !== undefined) running.delete(key);
  }
}
