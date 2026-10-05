import type { Query, QueryClient } from '@tanstack/react-query';

/**
 * `meta` every indexer-backed history query carries (the shared pagination
 * hooks set it), so a confirmed transaction can refresh them all without each
 * product naming its own keys.
 */
export const HISTORY_QUERY_META = { history: true } as const;

const isHistoryQuery = (query: Query) => query.meta?.history === true;

/**
 * Gaps between refetches after the immediate one, ~60s in all. Front-loaded:
 * the indexer usually lands a transaction within a few seconds of its receipt,
 * but a lagging indexer can take much longer, and a fixed short trail then
 * leaves the table stale until it remounts.
 */
export const HISTORY_REFRESH_DELAYS_MS = [2_000, 3_000, 5_000, 5_000, 10_000, 15_000, 20_000] as const;

type HistoryRow = { transactionHash?: unknown };

function txHashesOf(data: unknown): Set<string> {
  // Paginated histories cache InfiniteData ({ pages: [{ items }] }); the rest cache the row array.
  const pages = (data as { pages?: { items?: HistoryRow[] }[] } | undefined)?.pages;
  const rows: HistoryRow[] = pages
    ? pages.flatMap(page => page?.items ?? [])
    : Array.isArray(data)
      ? data
      : [];
  const hashes = new Set<string>();
  for (const row of rows) {
    if (typeof row?.transactionHash === 'string') hashes.add(row.transactionHash.toLowerCase());
  }
  return hashes;
}

/**
 * Refetches the history queries until the indexer has caught up with a just
 * confirmed transaction, or the delays run out. Caught up means a history
 * query holds `txHash`, or holds a row it did not have before the refresh —
 * the fallback for flows whose reported hash is not the indexed one (a Safe
 * transaction hash) or is missing.
 *
 * Only mounted queries refetch; the rest are marked stale, so a table mounted
 * mid-refresh fetches on mount and is then followed by the remaining rounds.
 */
export async function refreshHistoryUntilIndexed(queryClient: QueryClient, txHash?: string) {
  const cache = queryClient.getQueryCache();
  const target = txHash?.toLowerCase();
  const before = new Map(
    cache
      .findAll({ predicate: isHistoryQuery })
      .filter(query => query.state.data !== undefined)
      .map(query => [query.queryHash, txHashesOf(query.state.data)])
  );

  const isIndexed = () =>
    cache.findAll({ predicate: isHistoryQuery }).some(query => {
      const hashes = txHashesOf(query.state.data);
      if (target && hashes.has(target)) return true;
      const previous = before.get(query.queryHash);
      return previous !== undefined && [...hashes].some(hash => !previous.has(hash));
    });

  for (let round = 0; ; round++) {
    await queryClient.invalidateQueries({ predicate: isHistoryQuery });
    if (isIndexed() || round === HISTORY_REFRESH_DELAYS_MS.length) return;
    await new Promise(resolve => setTimeout(resolve, HISTORY_REFRESH_DELAYS_MS[round]));
  }
}
