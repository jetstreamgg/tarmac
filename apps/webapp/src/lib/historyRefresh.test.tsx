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

const PROD_PROXY = 'https://proxy.sky.money';
const STAGING_PROXY = 'https://staging-proxy.sky.money';

// A mounted (observed) query, the way a rendered history table holds one.
// `delayMs` makes each fetch take that long; the data is the call count.
function mountQuery(client: QueryClient, queryKey: QueryKey, meta: Record<string, unknown>, delayMs = 0) {
  let calls = 0;
  const queryFn = vi.fn(() => {
    const call = ++calls;
    return new Promise<number>(resolve => setTimeout(() => resolve(call), delayMs));
  });
  const observer = new QueryObserver(client, { queryKey, queryFn, meta, staleTime: 60_000 });
  const unsubscribe = observer.subscribe(() => {});
  return { queryFn, observer, unsubscribe };
}

type Progress = number | Error | { errors: { message: string }[] };

// Each indexer's `_meta` answers with its successive progress blocks in turn
// (the last repeats). An indexer given a plain list is the production one.
function stubIndexerProgress(progress: Progress[] | Record<string, Progress[]>) {
  const byOrigin = Array.isArray(progress) ? { [PROD_PROXY]: progress } : progress;
  const calls: Record<string, number> = {};
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const origin = Object.keys(byOrigin).find(o => url.startsWith(`${o}/`));
    if (!origin) throw new Error(`unexpected indexer ${url}`);
    const blocks = byOrigin[origin];
    const call = (calls[origin] = (calls[origin] ?? 0) + 1);
    const block = blocks[Math.min(call - 1, blocks.length - 1)];
    if (block instanceof Error) throw block;
    if (typeof block === 'object') return new Response(JSON.stringify(block));
    return new Response(JSON.stringify({ data: { _meta: [{ progressBlock: block }] } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof stubIndexerProgress>, origin: string) =>
  fetchMock.mock.calls.filter(([url]) => url.startsWith(`${origin}/`)).length;

const TX = { chainId: 1, blockNumber: 100n };

describe('refreshHistoryAfterTx', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    // The tables' proxy and the hooks' default point at one indexer unless a test says otherwise.
    vi.stubEnv('VITE_PROXY_ORIGIN', PROD_PROXY);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('refetches indexer history once, after the indexer reaches the receipt block', async () => {
    const fetchMock = stubIndexerProgress([98, 99, 100]);
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

  it('runs one refresh for a success reported twice, and a fresh one once it has finished', async () => {
    const fetchMock = stubIndexerProgress([99, 100]);
    const { queryFn } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(queryFn).toHaveBeenCalledTimes(2);

    // The follow-ups are part of the refresh: the same block only runs again after them.
    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS.at(-1)!);
    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('waits for every indexer the tables read when the proxy origin is a separate deployment', async () => {
    vi.stubEnv('VITE_PROXY_ORIGIN', STAGING_PROXY);
    const fetchMock = stubIndexerProgress({ [PROD_PROXY]: [100], [STAGING_PROXY]: [98, 99, 100] });
    const { queryFn } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    // Production has the block; the staging indexer the module tables read doesn't yet.
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(2);
    // An indexer that reached the block isn't asked again.
    expect(callsTo(fetchMock, PROD_PROXY)).toBe(1);
    expect(callsTo(fetchMock, STAGING_PROXY)).toBe(3);
  });

  it('refetches anyway once the wait runs out on an unreachable indexer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubIndexerProgress([new Error('offline')]);
    const { queryFn } = mountQuery(client, ['stake-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_WAIT_MS - INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('warns once when the indexer answers the progress query with an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubIndexerProgress([{ errors: [{ message: 'field "_meta" not found' }] }]);
    mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(INDEXER_WAIT_MS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][1])).toContain('field "_meta" not found');
  });

  it('follows up on third-party history on its own schedule, counted from the receipt', async () => {
    stubIndexerProgress([100]);
    const indexer = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    const external = mountQuery(client, ['morpho-vault-history'], EXTERNAL_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(0);
    expect(indexer.queryFn).toHaveBeenCalledTimes(2);
    expect(external.queryFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS[0] - 1);
    expect(external.queryFn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(external.queryFn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS.at(-1)!);
    expect(indexer.queryFn).toHaveBeenCalledTimes(2);
    expect(external.queryFn).toHaveBeenCalledTimes(2 + EXTERNAL_FOLLOW_UPS_MS.length);
  });

  it('falls back to fixed refreshes when the success carries no receipt block', async () => {
    const fetchMock = stubIndexerProgress([100]);
    const { queryFn } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, { chainId: 1 });
    await vi.advanceTimersByTimeAsync(NO_BLOCK_REFRESHES_MS.at(-1)! + INDEXER_WAIT_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queryFn).toHaveBeenCalledTimes(1 + NO_BLOCK_REFRESHES_MS.length);
  });

  it('marks unmounted history stale at once, so a table mounted during the wait fetches', async () => {
    stubIndexerProgress([99]);
    const { queryFn, unsubscribe } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META);
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['savings-history'])?.isInvalidated).toBe(true);
  });

  it('leaves queries without a history meta alone', async () => {
    stubIndexerProgress([100]);
    const { queryFn } = mountQuery(client, ['readContract'], {});
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(EXTERNAL_FOLLOW_UPS_MS.at(-1)!);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['readContract'])?.isInvalidated).toBe(false);
  });

  it('restarts a refetch that left before the indexer had the block, instead of keeping its rows', async () => {
    stubIndexerProgress([99, 100]);
    const { queryFn, observer } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META, 2_000);
    await vi.advanceTimersByTimeAsync(2_000);

    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(100);
    // A focus refetch leaves while the indexer is still behind.
    void observer.refetch({ cancelRefetch: false });
    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS + 4_000);

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(observer.getCurrentResult().data).toBe(3);
  });

  it('lets a first load that left before the indexer had the block finish, then refetches it', async () => {
    stubIndexerProgress([99, 100]);
    void refreshHistoryAfterTx(client, TX);
    // A table mounts during the wait: no data yet, so its load can't be cancelled.
    const { queryFn, observer } = mountQuery(client, ['savings-history'], INDEXER_HISTORY_META, 2_000);
    await vi.advanceTimersByTimeAsync(INDEXER_POLL_MS);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toBe(2);
  });

  it('keeps a "load more" page fetch that is in flight when the refresh lands, then refetches', async () => {
    stubIndexerProgress([100]);
    const queryFn = vi.fn(
      ({ pageParam }: { pageParam: number }) =>
        new Promise<number>(resolve => setTimeout(() => resolve(pageParam), 1_000))
    );
    const observer = new InfiniteQueryObserver(client, {
      queryKey: ['savings-history'],
      meta: INDEXER_HISTORY_META,
      initialPageParam: 0,
      getNextPageParam: (_last: number, pages: number[]) => (pages.length < 3 ? pages.length : undefined),
      queryFn
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(1_000);

    void observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(100);
    void refreshHistoryAfterTx(client, TX);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(observer.getCurrentResult().data?.pages).toEqual([0, 1]);
    // First page, the user's page, then both again once it landed.
    expect(queryFn).toHaveBeenCalledTimes(4);
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
