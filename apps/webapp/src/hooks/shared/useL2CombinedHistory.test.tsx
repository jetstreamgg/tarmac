/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CombinedHistoryItem } from './shared';

vi.mock('../psm/useL2SavingsHistory', () => ({ useL2SavingsHistory: vi.fn() }));
vi.mock('../trade/useTradeHistory', () => ({ useTradeHistory: vi.fn() }));

import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { useTradeHistory } from '../trade/useTradeHistory';
import { useL2CombinedHistory } from './useL2CombinedHistory';

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

describe('useL2CombinedHistory — savings + trade floor merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useL2SavingsHistory).mockReturnValue(source() as any);
    vi.mocked(useTradeHistory).mockReturnValue(source() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges both sides sorted desc when neither is paginating', () => {
    vi.mocked(useL2SavingsHistory).mockReturnValue(source({ data: [item(300, '0xsavings')] }) as any);
    vi.mocked(useTradeHistory).mockReturnValue(source({ data: [item(500, '0xtrade')] }) as any);

    const { result } = renderHook(() => useL2CombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xtrade', '0xsavings']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('withholds items older than the newest completeness floor', () => {
    // Trades still have pages down to t=400; the older savings row must wait.
    vi.mocked(useL2SavingsHistory).mockReturnValue(
      source({ data: [item(600, '0xsavings-new'), item(350, '0xsavings-old')], nextCursor: 200 }) as any
    );
    vi.mocked(useTradeHistory).mockReturnValue(
      source({ data: [item(500, '0xtrade')], nextCursor: 400, hasNextPage: true }) as any
    );

    const { result } = renderHook(() => useL2CombinedHistory());

    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xsavings-new', '0xtrade']);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('advances only the side holding the floor', () => {
    const savings = source({ nextCursor: 400, hasNextPage: true });
    const trade = source({ nextCursor: 200, hasNextPage: true });
    vi.mocked(useL2SavingsHistory).mockReturnValue(savings as any);
    vi.mocked(useTradeHistory).mockReturnValue(trade as any);

    const { result } = renderHook(() => useL2CombinedHistory());
    result.current.fetchNextPage();

    expect(savings.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(trade.fetchNextPage).not.toHaveBeenCalled();
  });

  it('advances the remaining side once the other is exhausted', () => {
    const savings = source({ nextCursor: undefined, hasNextPage: false });
    const trade = source({ nextCursor: 200, hasNextPage: true });
    vi.mocked(useL2SavingsHistory).mockReturnValue(savings as any);
    vi.mocked(useTradeHistory).mockReturnValue(trade as any);

    const { result } = renderHook(() => useL2CombinedHistory());
    result.current.fetchNextPage();

    expect(trade.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(savings.fetchNextPage).not.toHaveBeenCalled();
  });
});
