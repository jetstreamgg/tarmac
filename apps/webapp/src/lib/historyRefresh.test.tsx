import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import {
  InfiniteQueryObserver,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
  type QueryKey
} from '@tanstack/react-query';
import { EXTERNAL_HISTORY_META, INDEXER_HISTORY_META } from '@/hooks/constants';
import { useHistoryPagination } from '@/hooks/shared/useHistoryPagination';
import {
  EXTERNAL_FOLLOW_UPS_MS,
  INDEXER_POLL_MS,
  INDEXER_WAIT_MS,
  NO_BLOCK_REFRESHES_MS,
  refreshHistoryAfterTx
} from './historyRefresh';

// A mounted (observed) query, the way a rendered history table holds one.
function mountQuery(client: QueryClient, queryKey: QueryKey, meta: Record<string, unknown>) {
  const queryFn = vi.fn(async () => ['row']);
  const observer = new QueryObserver(client, { queryKey, queryFn, meta, staleTime: 60_000 });
  const unsubscribe = observer.subscribe(() => {});
  return { queryFn, unsubscribe };
}

// The indexer's `_meta` answers with each successive progress block in turn (the last repeats).
function stubIndexerProgress(...blocks: (number | Error)[]) {
  let call = 0;
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const block = blocks[Math.min(call++, blocks.length - 1)];
    if (block instanceof Error) throw block;
    return new Response(JSON.stringify({ data: { _meta: [{ progressBlock: block }] } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const TX = { chainId: 1, blockNumber: 100n };

describe('refreshHistoryAfterTx', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('refetches indexer history once, after the indexer reaches the receipt block', async () => {
    const fetchMock = stubIndexerProgress(98, 99, 100);
    const { queryFn } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    // Still behind: no refetch would bring the row yet.
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('_meta(where: { chainId: { _eq: 1 } })');
    expect(queryFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(INDEXER_WAIT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('refetches anyway once the wait runs out on an unreachable indexer', async () => {
    stubIndexerProgress(new Error('offline'));
    const { queryFn } = mountQuery(client, ['stake-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_WAIT_MS - INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('follows up on third-party history, which the indexer height says nothing about', async () => {
    stubIndexerProgress(100);
    const indexer = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    const external = mountQuery(client, ['morpho-vault-history'], EXTERNAL_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(0);
    expect(indexer.queryFn).toHaveBeenCalledTimes(2);
    expect(external.queryFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS.at(-1)!);
    expect(indexer.queryFn).toHaveBeenCalledTimes(2);
    expect(external.queryFn).toHaveBeenCalledTimes(2 + EXTERNAL_FOLLOW_UPS_MS.length);
  });

  it('falls back to fixed refreshes when the success carries no receipt block', async () => {
    const fetchMock = stubIndexerProgress(100);
    const { queryFn } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, { chainId: 1 });
    await vi.advanceTimersByTimeAsync(NO_BLOCK_REFRESHES_MS.at(-1)! + INDEXER_WAIT_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queryFn).toHaveBeenCalledTimes(1 + NO_BLOCK_REFRESHES_MS.length);
  });

  it('marks unmounted history stale at once, so a table mounted during the wait fetches', async () => {
    stubIndexerProgress(99);
    const { queryFn, unsubscribe } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['savings-history'])?.isInvalidated).toBe(true);
  });

  it('leaves queries without a history meta alone', async () => {
    stubIndexerProgress(100);
    const { queryFn } = mountQuery(client, ['readContract'], {});
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS.at(-1)!);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['readContract'])?.isInvalidated).toBe(false);
  });

  it('keeps a "load more" page fetch that is in flight when the refresh lands', async () => {
    stubIndexerProgress(100);
    const observer = new InfiniteQueryObserver(client, {
      queryKey: ['savings-history'],
      meta: INDEXER_HISTORY_META,
      initialPageParam: 0,
      getNextPageParam: (_last: number, pages: number[]) => (pages.length < 3 ? pages.length : undefined),
      queryFn: ({ pageParam }) => new Promise<number>(resolve => setTimeout(() => resolve(pageParam), 1_000))
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(1_000);

    void observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(100);
    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(observer.getCurrentResult().data?.pages).toEqual([0, 1]);
    unsubscribe();
  });
});

describe('history query tagging', () => {
  it('tags every paginated indexer history query for the post-tx refresh', () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(
      () =>
        useHistoryPagination({
          enabled: false,
          queryKey: ['savings-history'],
          fetchPage: async () => ({ items: [], nextCursor: undefined })
        }),
      { wrapper }
    );

    expect(client.getQueryCache().find({ queryKey: ['savings-history'] })?.meta).toEqual(
      INDEXER_HISTORY_META
    );
    client.clear();
  });
});
