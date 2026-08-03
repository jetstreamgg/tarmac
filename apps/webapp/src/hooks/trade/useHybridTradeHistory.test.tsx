/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';

vi.mock('./useCowswapTradeHistory', () => ({ useCowswapTradeHistory: vi.fn() }));
vi.mock('../psm/usePsmTradeHistory', () => ({ usePsmTradeHistory: vi.fn() }));

import { useCowswapTradeHistory } from './useCowswapTradeHistory';
import { usePsmTradeHistory } from '../psm/usePsmTradeHistory';
import { useHybridTradeHistory } from './useHybridTradeHistory';

const item = (timestamp: Date, transactionHash: string) => ({ blockTimestamp: timestamp, transactionHash });

const source = (overrides: Record<string, unknown> = {}) => ({
  data: [] as ReturnType<typeof item>[],
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  nextCursor: undefined as number | undefined,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  dataSources: [],
  ...overrides
});

describe('useHybridTradeHistory — PSM pages under the CoW feed', () => {
  const cutoff = TRADE_CUTOFF_DATES[chainIdMap.base];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePsmTradeHistory).mockReturnValue(source() as any);
    vi.mocked(useCowswapTradeHistory).mockReturnValue(source() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges CoW-after-cutoff over PSM rows, dropping pre-cutoff CoW trades', () => {
    const psmTime = new Date(cutoff.getTime() - 5000);
    vi.mocked(usePsmTradeHistory).mockReturnValue(source({ data: [item(psmTime, '0xpsm')] }) as any);
    vi.mocked(useCowswapTradeHistory).mockReturnValue(
      source({
        data: [
          item(new Date(cutoff.getTime() + 1000), '0xcow-after'),
          item(new Date(cutoff.getTime() - 1000), '0xcow-before')
        ]
      }) as any
    );

    const { result } = renderHook(() => useHybridTradeHistory({ chainId: chainIdMap.base }));

    expect(result.current.data!.map(i => i.transactionHash)).toEqual(['0xcow-after', '0xpsm']);
  });

  it('passes the PSM side pagination through — every CoW row is newer than any PSM page', () => {
    const psm = source({ nextCursor: 400, hasNextPage: true, isFetchingNextPage: false });
    vi.mocked(usePsmTradeHistory).mockReturnValue(psm as any);

    const { result } = renderHook(() => useHybridTradeHistory({ chainId: chainIdMap.base }));

    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.nextCursor).toBe(400);
    result.current.fetchNextPage();
    expect(psm.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
