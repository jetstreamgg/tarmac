import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateStakeQueries } from './invalidateStakeQueries';

const makeClient = () => ({ invalidateQueries: vi.fn() }) as unknown as QueryClient;
const keysCalled = (client: QueryClient) =>
  (client.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.map(([arg]) => arg.queryKey[0]);

describe('invalidateStakeQueries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('invalidates every stake read immediately', () => {
    const client = makeClient();
    invalidateStakeQueries(client);

    expect(keysCalled(client)).toEqual([
      'stake-user-positions',
      'stake-history',
      'readContract',
      'readContracts',
      'simulateDrip'
    ]);
  });

  it('re-invalidates only the subgraph keys along the lag trail', () => {
    const client = makeClient();
    invalidateStakeQueries(client);
    (client.invalidateQueries as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(5_000);
    expect(keysCalled(client)).toEqual(['stake-user-positions', 'stake-history']);

    vi.advanceTimersByTime(10_000);
    expect(keysCalled(client)).toEqual([
      'stake-user-positions',
      'stake-history',
      'stake-user-positions',
      'stake-history'
    ]);

    vi.advanceTimersByTime(60_000);
    expect((client.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4);
  });
});
