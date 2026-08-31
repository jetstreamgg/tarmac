/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { HISTORY_QUERY_LIMIT, ModuleEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';

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
import { useL2sIndexerHistory } from './useL2sIndexerHistory';

const USER = '0x1111111111111111111111111111111111111111';
const L2_CHAIN_IDS = [chainIdMap.base, chainIdMap.arbitrum, chainIdMap.optimism, chainIdMap.unichain];

const swapRow = (timestamp: number, chainId: number, susdsIsIn: boolean) => ({
  transactionHash: `0xswap${timestamp}`,
  assetIn: susdsIsIn ? TOKENS.susds.address[chainId] : TOKENS.usds.address[chainId],
  assetOut: susdsIsIn ? TOKENS.usds.address[chainId] : TOKENS.susds.address[chainId],
  sender: USER,
  amountIn: '1000',
  amountOut: '999',
  blockTimestamp: String(timestamp)
});

function emptyResponse(): Record<string, any[]> {
  const response: Record<string, any[]> = {};
  for (const chainId of L2_CHAIN_IDS) {
    response[`usdsIn_${chainId}`] = [];
    response[`usdsOut_${chainId}`] = [];
    response[`swaps_${chainId}`] = [];
  }
  return response;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useL2sIndexerHistory — all-L2s indexer document', () => {
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

  it('fetches savings + trade swaps for every L2 in one request', async () => {
    const response = emptyResponse();
    response[`usdsIn_${chainIdMap.base}`] = [swapRow(1700000200, chainIdMap.base, true)];
    response[`swaps_${chainIdMap.arbitrum}`] = [swapRow(1700000100, chainIdMap.arbitrum, false)];
    vi.mocked(request).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useL2sIndexerHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(request).toHaveBeenCalledTimes(1);

    const query = vi.mocked(request).mock.calls[0][1] as string;
    for (const chainId of L2_CHAIN_IDS) {
      expect(query).toContain(`usdsIn_${chainId}: Swap`);
      expect(query).toContain(`usdsOut_${chainId}: Swap`);
      expect(query).toContain(`swaps_${chainId}: Swap`);
      expect(query).toContain(`chainId: { _eq: ${chainId} }`);
    }
    // Hybrid chains cap PSM trades at the CowSwap cutoff; pure-PSM chains don't.
    const cutoff = Math.floor(TRADE_CUTOFF_DATES[chainIdMap.base].getTime() / 1000);
    expect(query).toContain(`_lte: "${cutoff}"`);
    expect(query.match(/_lte:/g)).toHaveLength(2); // base + arbitrum only

    // Items map to their chain and merge sorted desc.
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].chainId).toBe(chainIdMap.base);
    expect(result.current.data![0].module).toBe(ModuleEnum.SAVINGS);
    expect(result.current.data![1].chainId).toBe(chainIdMap.arbitrum);
    expect(result.current.data![1].module).toBe(ModuleEnum.TRADE);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('keyset-paginates: clamps to the boundary and fetches the next page with _lt', async () => {
    const newest = 1700000000;
    const frontier = newest - HISTORY_QUERY_LIMIT + 1;
    const fullPage = emptyResponse();
    // One alias hits the limit → its oldest row is the completeness boundary.
    fullPage[`swaps_${chainIdMap.optimism}`] = Array.from({ length: HISTORY_QUERY_LIMIT }, (_, i) =>
      swapRow(newest - i, chainIdMap.optimism, false)
    );
    // An older row from another chain must be withheld from page 1...
    fullPage[`usdsIn_${chainIdMap.base}`] = [swapRow(frontier - 50, chainIdMap.base, true)];
    vi.mocked(request).mockResolvedValueOnce(fullPage);
    // ...and re-fetched (with everything else) on page 2.
    const lastPage = emptyResponse();
    lastPage[`usdsIn_${chainIdMap.base}`] = [swapRow(frontier - 50, chainIdMap.base, true)];
    vi.mocked(request).mockResolvedValueOnce(lastPage);

    const { result } = renderHook(() => useL2sIndexerHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT);
    expect(result.current.nextCursor).toBe(frontier);
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    const secondQuery = vi.mocked(request).mock.calls[1][1] as string;
    expect(secondQuery).toContain(`blockTimestamp: { _lt: "${frontier}" }`);
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT + 1);
    expect(result.current.data![HISTORY_QUERY_LIMIT].chainId).toBe(chainIdMap.base);
    expect(result.current.nextCursor).toBeUndefined();
  });
});
