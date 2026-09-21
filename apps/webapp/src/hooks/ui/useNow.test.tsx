import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('starts at the mount time', () => {
    const { result } = renderHook(() => useNow(60_000));
    expect(result.current).toBe(Date.now());
  });

  it('holds still between ticks and advances after the interval', () => {
    const { result } = renderHook(() => useNow(1_000));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(first);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(first + 1_000);
  });

  it('clears its timer on unmount', () => {
    const { unmount } = renderHook(() => useNow(2_000));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
