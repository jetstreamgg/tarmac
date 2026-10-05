import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver, type QueryKey } from '@tanstack/react-query';
import { HISTORY_QUERY_META, HISTORY_REFRESH_DELAYS_MS, refreshHistoryUntilIndexed } from './historyRefresh';

type Row = { transactionHash: string };

// A mounted (observed) query, the way a rendered history table holds one.
function mountQuery(
  client: QueryClient,
  queryKey: QueryKey,
  read: () => unknown,
  meta: Record<string, unknown> = HISTORY_QUERY_META
) {
  const queryFn = vi.fn(async () => read());
  const observer = new QueryObserver(client, { queryKey, queryFn, meta, staleTime: 60_000 });
  const unsubscribe = observer.subscribe(() => {});
  return { queryFn, unsubscribe };
}

// The cached shape of the keyset-paginated histories (useInfiniteQuery).
const infinite = (rows: Row[]) => ({
  pages: [{ items: rows, nextCursor: undefined }],
  pageParams: [undefined]
});

const totalDelay = HISTORY_REFRESH_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);

describe('refreshHistoryUntilIndexed', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    client.clear();
    vi.useRealTimers();
  });

  it('refetches until the confirmed transaction is indexed, then stops', async () => {
    let rows: Row[] = [{ transactionHash: '0xold' }];
    const { queryFn } = mountQuery(client, ['savings-history'], () => infinite(rows));
    await vi.advanceTimersByTimeAsync(0);
    expect(queryFn).toHaveBeenCalledTimes(1);

    let finished = false;
    void refreshHistoryUntilIndexed(client, '0xNEW').then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(finished).toBe(false);

    // The indexer catches up between the second and third rounds.
    rows = [{ transactionHash: '0xnew' }, ...rows];
    await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_DELAYS_MS[0]);
    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(finished).toBe(true);

    await vi.advanceTimersByTimeAsync(totalDelay);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('stops on any new row when the reported hash is not the indexed one', async () => {
    let rows: Row[] = [{ transactionHash: '0xold' }];
    const { queryFn } = mountQuery(client, ['morpho-vault-history'], () => rows);
    await vi.advanceTimersByTimeAsync(0);

    let finished = false;
    // e.g. a Safe transaction hash, which the indexer never stores.
    void refreshHistoryUntilIndexed(client, '0xsafe').then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(false);

    rows = [{ transactionHash: '0xexecuted' }, ...rows];
    await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_DELAYS_MS[0]);
    expect(finished).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('gives up once the delays run out', async () => {
    const { queryFn } = mountQuery(client, ['stake-history'], () => infinite([{ transactionHash: '0xold' }]));
    await vi.advanceTimersByTimeAsync(0);

    let finished = false;
    void refreshHistoryUntilIndexed(client, '0xnew').then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(totalDelay);

    expect(finished).toBe(true);
    // The initial mount fetch, the immediate round, then one per delay.
    expect(queryFn).toHaveBeenCalledTimes(2 + HISTORY_REFRESH_DELAYS_MS.length);
  });

  it('leaves queries without the history meta alone', async () => {
    const { queryFn } = mountQuery(client, ['readContract'], () => 1n, {});
    await vi.advanceTimersByTimeAsync(0);

    void refreshHistoryUntilIndexed(client, '0xnew');
    await vi.advanceTimersByTimeAsync(totalDelay);

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('marks unmounted history stale so it refetches on its next mount', async () => {
    const { queryFn, unsubscribe } = mountQuery(client, ['savings-history'], () =>
      infinite([{ transactionHash: '0xold' }])
    );
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();

    void refreshHistoryUntilIndexed(client, '0xnew');
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['savings-history'])?.isInvalidated).toBe(true);
  });
});
