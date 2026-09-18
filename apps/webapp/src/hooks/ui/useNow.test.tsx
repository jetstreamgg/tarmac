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

  it('returns the same instant for every call in one render', () => {
    const { result } = renderHook(() => {
      const a = useNow(60_000);
      const b = useNow(60_000);
      return { a, b };
    });
    expect(result.current.a).toBe(result.current.b);
    expect(result.current.a).toBe(Date.now());
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

  it('shares one timer per interval and stops it when the last subscriber leaves', () => {
    const one = renderHook(() => useNow(2_000));
    const two = renderHook(() => useNow(2_000));
    expect(vi.getTimerCount()).toBe(1);

    one.unmount();
    expect(vi.getTimerCount()).toBe(1);

    two.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not hand a fresh mount the value from before it went idle', () => {
    const { unmount } = renderHook(() => useNow(1_000));
    unmount();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    const { result } = renderHook(() => useNow(1_000));
    expect(result.current).toBe(Date.now());
  });
});
