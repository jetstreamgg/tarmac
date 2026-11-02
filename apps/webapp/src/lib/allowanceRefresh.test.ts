import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { ALLOWANCE_FOLLOW_UP_MS, refreshAllowancesAfterTx } from './allowanceRefresh';

const read = (functionName: string) => ['readContract', { chainId: 1, functionName, args: [] }];

const mount = (client: QueryClient, queryKey: unknown[]) => {
  const queryFn = vi.fn(async () => 1n);
  new QueryObserver(client, { queryKey, queryFn, staleTime: 30_000 }).subscribe(() => {});
  return queryFn;
};

describe('refreshAllowancesAfterTx', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refetches mounted allowance reads now and again one block later, leaving other reads alone', async () => {
    const client = new QueryClient();
    const allowance = mount(client, read('allowance'));
    const balance = mount(client, read('balanceOf'));
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
    client.setQueryData(read('allowance'), 5n);

    refreshAllowancesAfterTx(client);

    expect(client.getQueryData(read('allowance'))).toBeUndefined();
  });
});
