/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CombinedHistoryItem } from './shared';

vi.mock('./useEthereumIndexerHistory', () => ({ useEthereumIndexerHistory: vi.fn() }));
vi.mock('../trade/useCowswapTradeHistory', () => ({ useCowswapTradeHistory: vi.fn() }));
vi.mock('../morpho', () => ({ useMorphoVaultHistory: vi.fn() }));
vi.mock('../pendle/usePendleCombinedHistory', () => ({ usePendleCombinedHistory: vi.fn() }));

import { useEthereumIndexerHistory } from './useEthereumIndexerHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useMorphoVaultHistory } from '../morpho';
import { usePendleCombinedHistory } from '../pendle/usePendleCombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';

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

describe('useEthereumCombinedHistory — indexer + REST merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEthereumIndexerHistory).mockReturnValue(source() as any);
    vi.mocked(useCowswapTradeHistory).mockReturnValue(source() as any);
    vi.mocked(useMorphoVaultHistory).mockReturnValue(source() as any);
    vi.mocked(usePendleCombinedHistory).mockReturnValue(source() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('withholds REST items older than the indexer completeness floor', () => {
    vi.mocked(useEthereumIndexerHistory).mockReturnValue(
      source({ data: [item(500, '0xindexer')], nextCursor: 400, hasNextPage: true }) as any
    );
    vi.mocked(useMorphoVaultHistory).mockReturnValue(
      source({ data: [item(450, '0xmorpho-recent'), item(300, '0xmorpho-old')] }) as any
    );

    const { result } = renderHook(() => useEthereumCombinedHistory());

    // 0xmorpho-old would otherwise insert mid-list when page 2 lands.
    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xindexer', '0xmorpho-recent']);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.nextCursor).toBe(400);
  });

  it('emits everything once the indexer history is fully loaded', () => {
    vi.mocked(useEthereumIndexerHistory).mockReturnValue(source({ data: [item(500, '0xindexer')] }) as any);
    vi.mocked(usePendleCombinedHistory).mockReturnValue(source({ data: [item(100, '0xpendle')] }) as any);

    const { result } = renderHook(() => useEthereumCombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xindexer', '0xpendle']);
    expect(result.current.hasNextPage).toBe(false);
  });
});
