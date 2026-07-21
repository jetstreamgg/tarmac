import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { HISTORY_STALE_TIME } from '../constants';
import type { HistoryPage } from './historyQueryHelpers';

/** Pagination surface a keyset-paginated history hook adds on top of ReadHook. */
export type PaginatedHistory = {
  /** Completeness floor (seconds); undefined once history is fully loaded. */
  nextCursor: number | undefined;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
};

/**
 * Shared useInfiniteQuery wiring for the keyset-paginated history documents.
 * The fetcher receives the previous page's boundary as `beforeTimestamp` and
 * must return items clamped at their own completeness boundary (see
 * historyQueryHelpers), so pages are non-overlapping, each internally sorted
 * desc and strictly older than the previous one — concatenation preserves
 * global order.
 */
export function useHistoryPagination<T>({
  enabled,
  queryKey,
  fetchPage
}: {
  enabled: boolean;
  queryKey: readonly unknown[];
  fetchPage: (beforeTimestamp?: number) => Promise<HistoryPage<T>>;
}) {
  const { data, error, refetch, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      enabled,
      staleTime: HISTORY_STALE_TIME,
      queryKey,
      initialPageParam: undefined as number | undefined,
      queryFn: ({ pageParam }) => fetchPage(pageParam),
      getNextPageParam: lastPage => lastPage.nextCursor
    });

  const items = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor;

  return {
    data: data ? items : undefined,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate: refetch,
    /** Completeness floor (seconds); undefined once history is fully loaded. */
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  };
}
