import { HISTORY_QUERY_LIMIT } from '../constants';

/**
 * Keyset-pagination plumbing for the Envio history documents.
 *
 * Every history entity is queried `order_by: { blockTimestamp: desc }` with a
 * shared `limit`, so a page of a multi-alias document is only *complete* down
 * to the newest timestamp at which some alias got cut off by its limit (its
 * "frontier"). Items older than that boundary may have unfetched siblings in
 * other aliases interleaved between them, so they are withheld from the page
 * and re-fetched by the next one (`blockTimestamp: { _lt: boundary }`).
 *
 * Ties: `_lt` skips rows sharing the exact boundary timestamp that were
 * themselves cut off by the limit. That requires more than HISTORY_QUERY_LIMIT
 * same-entity events for one wallet in a single block — not a practical case.
 */

/** Argument list for a history entity query: bounded, newest-first, optionally under a keyset cursor. */
export function historyQueryArgs(where: string, beforeTimestamp?: number): string {
  const cursor = beforeTimestamp ? `, blockTimestamp: { _lt: "${beforeTimestamp}" }` : '';
  return `(where: { ${where}${cursor} }, order_by: { blockTimestamp: desc }, limit: ${HISTORY_QUERY_LIMIT})`;
}

type HistoryRow = { blockTimestamp: string };

function isHistoryRowList(node: unknown): node is HistoryRow[] {
  return (
    Array.isArray(node) &&
    node.length > 0 &&
    typeof node[0] === 'object' &&
    node[0] !== null &&
    'blockTimestamp' in node[0]
  );
}

/**
 * Collects every entity row list in a GraphQL response, including nested ones
 * (e.g. the reward contracts' supplyInstances/withdrawals/rewardClaims).
 */
export function collectHistoryLists(node: unknown, out: HistoryRow[][] = []): HistoryRow[][] {
  if (isHistoryRowList(node)) {
    out.push(node);
  } else if (Array.isArray(node)) {
    node.forEach(child => collectHistoryLists(child, out));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach(child => collectHistoryLists(child, out));
  }
  return out;
}

/**
 * The page's completeness boundary in seconds: the newest frontier among
 * aliases that hit the limit. `undefined` means no alias was cut off — the
 * page reaches the end of history and there is no next page.
 */
export function historyPageBoundary(response: unknown): number | undefined {
  const frontiers = collectHistoryLists(response)
    .filter(list => list.length >= HISTORY_QUERY_LIMIT)
    .map(list => parseInt(list[list.length - 1].blockTimestamp));
  return frontiers.length > 0 ? Math.max(...frontiers) : undefined;
}

/** Drops mapped items older than the boundary; they belong to the next page. */
export function clampHistoryPage<T extends { blockTimestamp: Date }>(items: T[], boundary?: number): T[] {
  if (boundary === undefined) return items;
  return items.filter(item => item.blockTimestamp.getTime() >= boundary * 1000);
}

/** Pagination surface the combined history hooks add on top of ReadHook. */
export type HistoryPagination = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

/** One fetched page of a history document. */
export type HistoryPage<T> = { items: T[]; nextCursor: number | undefined };
