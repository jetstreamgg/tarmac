import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { ALLOWANCE_META } from '@/hooks/constants';
import { ALLOWANCE_FOLLOW_UP_MS, refreshAllowancesAfterTx } from './allowanceRefresh';

const mount = (client: QueryClient, key: string, meta?: Record<string, unknown>) => {
  const queryFn = vi.fn(async () => 1n);
  new QueryObserver(client, { queryKey: [key], queryFn, meta, staleTime: 30_000 }).subscribe(() => {});
  return queryFn;
};

describe('refreshAllowancesAfterTx', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refetches mounted allowance reads now and again one block later, leaving other reads alone', async () => {
    const client = new QueryClient();
    const allowance = mount(client, 'allowance', ALLOWANCE_META);
    const balance = mount(client, 'balance');
    await vi.advanceTimersByTimeAsync(0);

    refreshAllowancesAfterTx(client);
    await vi.advanceTimersByTimeAsync(0);
    expect(allowance).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(ALLOWANCE_FOLLOW_UP_MS);
    expect(allowance).toHaveBeenCalledTimes(3);
    expect(balance).toHaveBeenCalledTimes(1);
  });

  it('clears an unmounted allowance read so the next launch cannot decide from the spent value', () => {
    const client = new QueryClient();
    client.getQueryCache().build(client, { queryKey: ['allowance'], meta: ALLOWANCE_META });
    client.setQueryData(['allowance'], 5n);

    refreshAllowancesAfterTx(client);

    expect(client.getQueryData(['allowance'])).toBeUndefined();
  });
});
