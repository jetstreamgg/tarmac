import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pickFractionDigits, useAccruingValue } from './useAccruingValue';

/** Per-second growth of the 3.75% SSR: (1.0375)^(1/31536000) - 1. */
const SSR_3_75 = Math.expm1(Math.log1p(0.0375) / (365 * 24 * 60 * 60));

afterEach(cleanup);

describe('pickFractionDigits', () => {
  // The whole point of the adaptive precision: one cadence across five orders of
  // magnitude, which a fixed decimal count can't give.
  it.each([
    [10_000_000, 2],
    [100_000, 4],
    [1_000, 6],
    [1, 9]
  ])('shows %i USDS to %i decimals', (amount, expected) => {
    expect(pickFractionDigits(amount, SSR_3_75)).toBe(expected);
  });

  it('keeps every balance down to 1 USDS on the target cadence', () => {
    for (const amount of [1, 10, 250, 1_000, 99_999, 100_000, 4_000_000]) {
      const digits = pickFractionDigits(amount, SSR_3_75);
      const tickSeconds = 10 ** -digits / (amount * SSR_3_75);
      expect(tickSeconds).toBeGreaterThan(0.25);
      expect(tickSeconds).toBeLessThan(2.6);
    }
  });

  it('caps sub-unit dust at the precision 1 USDS gets, and lets it tick slower', () => {
    const cap = pickFractionDigits(1, SSR_3_75);
    expect(pickFractionDigits(0.1, SSR_3_75)).toBe(cap);
    expect(pickFractionDigits(0.001, SSR_3_75)).toBe(cap);
  });

  it('never goes below cents, however large the position', () => {
    expect(pickFractionDigits(10 ** 12, SSR_3_75)).toBe(2);
  });

  it('re-derives the cap from the rate', () => {
    // A 10x rate earns a decimal place back at every balance.
    expect(pickFractionDigits(1, SSR_3_75 * 10)).toBe(pickFractionDigits(1, SSR_3_75) - 1);
  });
});

describe('useAccruingValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the amount still without a rate', () => {
    const { result } = renderHook(() => useAccruingValue({ amount: 100_000 }));
    expect(result.current.value).toBe(100_000);
    expect(result.current.fractionDigits).toBeUndefined();
  });

  it('holds a zero position still', () => {
    const { result } = renderHook(() => useAccruingValue({ amount: 0, ratePerSecond: SSR_3_75 }));
    expect(result.current.fractionDigits).toBeUndefined();
  });

  it('accrues at the rate and wakes once per digit turnover', () => {
    const { result } = renderHook(() => useAccruingValue({ amount: 100_000, ratePerSecond: SSR_3_75 }));
    expect(result.current.value).toBe(100_000);
    expect(result.current.fractionDigits).toBe(4);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // A minute of 3.75% on 100,000 USDS.
    const expected = 100_000 * Math.exp(Math.log1p(SSR_3_75) * 60);
    expect(result.current.value).toBeCloseTo(expected, 6);
    expect(result.current.value).toBeGreaterThan(100_000);
  });

  it('renders about once per target tick rather than on a fixed interval', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useAccruingValue({ amount: 100_000, ratePerSecond: SSR_3_75 });
    });
    const before = renders;

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // 10s at ~0.86s per tick ≈ 12 wake-ups; anything near 60fps would be ~600.
    const wakeUps = renders - before;
    expect(wakeUps).toBeGreaterThan(5);
    expect(wakeUps).toBeLessThan(25);
  });

  it('ignores a read that lands just behind the projection', () => {
    const { result, rerender } = renderHook(
      ({ amount }) => useAccruingValue({ amount, ratePerSecond: SSR_3_75 }),
      { initialProps: { amount: 100_000 } }
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    const projected = result.current.value;
    expect(projected).toBeGreaterThan(100_000);

    // The chain reports the balance as of a block we've already projected past.
    rerender({ amount: 100_000.0001 });
    expect(result.current.value).toBeGreaterThanOrEqual(projected);
  });

  it('accepts a withdrawal, which clears the drift tolerance', () => {
    const { result, rerender } = renderHook(
      ({ amount }) => useAccruingValue({ amount, ratePerSecond: SSR_3_75 }),
      { initialProps: { amount: 100_000 } }
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    rerender({ amount: 40_000 });
    expect(result.current.value).toBeCloseTo(40_000, 4);
  });

  it('re-baselines on a supply', () => {
    const { result, rerender } = renderHook(
      ({ amount }) => useAccruingValue({ amount, ratePerSecond: SSR_3_75 }),
      { initialProps: { amount: 1_000 } }
    );
    expect(result.current.fractionDigits).toBe(6);

    rerender({ amount: 100_000 });
    expect(result.current.value).toBeCloseTo(100_000, 4);
    // The bigger position earns faster, so a coarser digit carries the cadence.
    expect(result.current.fractionDigits).toBe(4);
  });
});
