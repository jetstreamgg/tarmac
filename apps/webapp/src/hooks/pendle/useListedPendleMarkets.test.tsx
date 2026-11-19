import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PENDLE_MARKETS } from './constants';
import { useListedPendleMarkets } from './useListedPendleMarkets';

describe('useListedPendleMarkets', () => {
  const predecessor = PENDLE_MARKETS[0];
  const LIST_FROM = predecessor.expiry;
  const successor = {
    ...predecessor,
    slug: 'pt-successor',
    marketAddress: '0x00000000000000000000000000000000000000aa' as const,
    listFrom: LIST_FROM
  };
  const originalLength = PENDLE_MARKETS.length;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime((LIST_FROM - 90) * 1000);
    PENDLE_MARKETS.push(successor);
  });

  afterEach(() => {
    PENDLE_MARKETS.length = originalLength;
    vi.useRealTimers();
  });

  it('adds the successor once the clock passes listFrom, keeping identity stable in between', () => {
    const { result } = renderHook(() => useListedPendleMarkets());
    const before = result.current;
    expect(before).toEqual([predecessor]);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(before);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual([predecessor, successor]);
  });
});
