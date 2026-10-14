/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettledAmount } from './useSettledAmount';

type Props = { amount: bigint; unit?: string };

const render = (initial: Props) =>
  renderHook(({ amount, unit }: Props) => useSettledAmount(amount, unit), { initialProps: initial });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSettledAmount', () => {
  it('holds a typed amount until typing pauses', () => {
    const { result, rerender } = render({ amount: 1n, unit: 'USDS' });
    expect(result.current).toEqual({ debouncedAmount: 1n, debouncePending: false });

    rerender({ amount: 12n, unit: 'USDS' });
    act(() => vi.advanceTimersByTime(300));
    rerender({ amount: 123n, unit: 'USDS' });
    act(() => vi.advanceTimersByTime(300));
    // 600ms since the first keystroke, 300ms since the last: still waiting.
    expect(result.current).toEqual({ debouncedAmount: 1n, debouncePending: true });

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toEqual({ debouncedAmount: 123n, debouncePending: false });
  });

  it('adopts the new amount at once when the unit changes', () => {
    // 100 USDS (18 decimals) re-read as 100 USDC (6 decimals) after a token pick.
    const { result, rerender } = render({ amount: 100n * 10n ** 18n, unit: 'USDS:18' });

    rerender({ amount: 100n * 10n ** 6n, unit: 'USDC:6' });
    expect(result.current).toEqual({ debouncedAmount: 100n * 10n ** 6n, debouncePending: false });

    // Debouncing resumes from the new unit: the next keystroke waits again.
    act(() => vi.advanceTimersByTime(0));
    rerender({ amount: 1000n * 10n ** 6n, unit: 'USDC:6' });
    expect(result.current).toEqual({ debouncedAmount: 100n * 10n ** 6n, debouncePending: true });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.debouncedAmount).toBe(1000n * 10n ** 6n);
  });

  it('settles a cleared input at once', () => {
    const { result, rerender } = render({ amount: 50n, unit: 'USDS' });

    rerender({ amount: 0n, unit: 'USDS' });
    expect(result.current).toEqual({ debouncedAmount: 0n, debouncePending: false });
  });
});
