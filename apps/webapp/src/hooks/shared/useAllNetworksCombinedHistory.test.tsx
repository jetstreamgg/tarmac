/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';
import type { CombinedHistoryItem } from './shared';

vi.mock('./useEthereumCombinedHistory', () => ({ useEthereumCombinedHistory: vi.fn() }));
vi.mock('./useL2sIndexerHistory', () => ({ useL2sIndexerHistory: vi.fn() }));
vi.mock('../trade/useCowswapTradeHistory', () => ({ useCowswapTradeHistory: vi.fn() }));

import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useL2sIndexerHistory } from './useL2sIndexerHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useAllNetworksCombinedHistory } from './useAllNetworksCombinedHistory';

const item = (timestampSeconds: number, transactionHash: string) =>
  ({ blockTimestamp: new Date(timestampSeconds * 1000), transactionHash }) as CombinedHistoryItem;

const source = (overrides: Record<string, unknown> = {}) => ({
  data: [] as CombinedHistoryItem[],
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  nextCursor: undefined as number | undefined,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  ...overrides
});

describe('useAllNetworksCombinedHistory — cross-source merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(source() as any);
    vi.mocked(useL2sIndexerHistory).mockReturnValue(source() as any);
    vi.mocked(useCowswapTradeHistory).mockReturnValue(source() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges all sources sorted desc when nothing is paginating', () => {
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(source({ data: [item(300, '0xeth')] }) as any);
    vi.mocked(useL2sIndexerHistory).mockReturnValue(source({ data: [item(500, '0xl2')] }) as any);

    const { result } = renderHook(() => useAllNetworksCombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xl2', '0xeth']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('clamps every source at the newest completeness floor', () => {
    // The L2 side still has pages down to t=400; anything older is withheld.
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(
      source({ data: [item(600, '0xeth-new'), item(350, '0xeth-old')], nextCursor: 200 }) as any
    );
    vi.mocked(useL2sIndexerHistory).mockReturnValue(
      source({ data: [item(500, '0xl2')], nextCursor: 400, hasNextPage: true }) as any
    );

    const { result } = renderHook(() => useAllNetworksCombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xeth-new', '0xl2']);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('drops L2 CoW trades from before the PSM cutoff', () => {
    const cutoff = TRADE_CUTOFF_DATES[chainIdMap.base];
    const before = new Date(cutoff.getTime() - 1000);
    const after = new Date(cutoff.getTime() + 1000);
    vi.mocked(useCowswapTradeHistory).mockImplementation((({ chainId }: { chainId: number }) =>
      chainId === chainIdMap.base
        ? source({
            data: [
              { blockTimestamp: after, transactionHash: '0xcow-after' },
              { blockTimestamp: before, transactionHash: '0xcow-before' }
            ]
          })
        : source()) as any);

    const { result } = renderHook(() => useAllNetworksCombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xcow-after']);
  });

  it('advances only the side holding the global floor', () => {
    const ethereum = source({ nextCursor: 200, hasNextPage: true });
    const l2 = source({ nextCursor: 400, hasNextPage: true });
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(ethereum as any);
    vi.mocked(useL2sIndexerHistory).mockReturnValue(l2 as any);

    const { result } = renderHook(() => useAllNetworksCombinedHistory());
    result.current.fetchNextPage();

    // L2's floor (400) is the newest → it is the limiting side.
    expect(l2.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(ethereum.fetchNextPage).not.toHaveBeenCalled();
  });

  it('advances the remaining side once the other is exhausted', () => {
    const ethereum = source({ nextCursor: 200, hasNextPage: true });
    const l2 = source({ nextCursor: undefined, hasNextPage: false });
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(ethereum as any);
    vi.mocked(useL2sIndexerHistory).mockReturnValue(l2 as any);

    const { result } = renderHook(() => useAllNetworksCombinedHistory());
    result.current.fetchNextPage();

    expect(ethereum.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(l2.fetchNextPage).not.toHaveBeenCalled();
  });
});
