/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { HISTORY_QUERY_LIMIT } from '../constants';

// Reconstruct the interpolated query string so assertions can inspect it.
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(values[i]) : ''), '')
}));

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
  useChainId: vi.fn()
}));

import { request } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { useStakeHistory } from './useStakeHistory';

const USER = '0x1111111111111111111111111111111111111111';

const EMPTY_RESPONSE = {
  stakingOpens: [],
  stakingSelectVoteDelegates: [],
  stakingSelectRewards: [],
  stakingLocks: [],
  stakingFrees: [],
  stakingDraws: [],
  stakingWipes: [],
  stakingGetRewards: [],
  stakingOnKicks: []
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/**
 * Representative pagination-cycle test for the per-module history hooks — they
 * all share useHistoryPagination + the boundary/clamp helpers, so the stake
 * hook (densest document: 9 entities) stands in for the family.
 */
describe('useStakeHistory — keyset-paginated module document', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
    vi.mocked(useChainId).mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches one bounded document and reports no next page when nothing hits the limit', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      stakingLocks: [{ index: '0', wad: '50', blockTimestamp: '1700000200', transactionHash: '0xlock' }]
    });

    const { result } = renderHook(() => useStakeHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(request).toHaveBeenCalledTimes(1);
    const query = vi.mocked(request).mock.calls[0][1] as string;
    expect(query).toContain(`owner: { _eq: "${USER}" }`);
    expect(query).toContain(`limit: ${HISTORY_QUERY_LIMIT}`);
    expect(query).not.toContain('_ilike');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.nextCursor).toBeUndefined();
  });

  it('clamps a full page at its boundary and fetches the next one with _lt', async () => {
    const newest = 1700000000;
    const frontier = newest - HISTORY_QUERY_LIMIT + 1;
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      // Locks hit the limit → their oldest row is the page boundary.
      stakingLocks: Array.from({ length: HISTORY_QUERY_LIMIT }, (_, i) => ({
        index: '0',
        wad: '50',
        blockTimestamp: String(newest - i),
        transactionHash: `0xlock${i}`
      })),
      // An unstake older than the boundary is withheld from page 1.
      stakingFrees: [
        { index: '0', wad: '10', blockTimestamp: String(frontier - 5), transactionHash: '0xoldfree' }
      ]
    });
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      stakingFrees: [
        { index: '0', wad: '10', blockTimestamp: String(frontier - 5), transactionHash: '0xoldfree' }
      ]
    });

    const { result } = renderHook(() => useStakeHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT);
    expect(result.current.data!.some(item => item.transactionHash === '0xoldfree')).toBe(false);
    expect(result.current.nextCursor).toBe(frontier);
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    const secondQuery = vi.mocked(request).mock.calls[1][1] as string;
    expect(secondQuery).toContain(`blockTimestamp: { _lt: "${frontier}" }`);
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT + 1);
    expect(result.current.data![HISTORY_QUERY_LIMIT].transactionHash).toBe('0xoldfree');
  });
});
