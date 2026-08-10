import { useEffect, useRef, useState } from 'react';

/**
 * Projects a continuously-compounding balance forward between chain reads, so a
 * position figure visibly earns while you watch it (Figma 1598:76444 — the
 * savings hero's rolling counter).
 *
 * Two things have to be decided here, and they are coupled:
 *
 *  1. **How fast to tick.** The comp rolls three digits over a 2.202s loop, so a
 *     digit dwells ~734ms. That cadence is a design constant; the accrual rate
 *     is not.
 *  2. **Which digit ticks.** A fixed precision can't serve every balance: at the
 *     comp's own 5 decimals, 100,000 USDS at 3.75% would tick ~12x a second
 *     (a blur) while 1,000 USDS would tick once every 8.5s (frozen).
 *
 * So the precision is chosen per position to land the cadence on the comp's,
 * which keeps the *motion* constant and lets the *precision* absorb the spread
 * in balances. See `pickFractionDigits` for the cap.
 */

/** The comp's per-digit dwell (2.202s / 3 digits ≈ 734ms), rounded. */
const TARGET_TICK_MS = 800;

/** A hero figure never drops below cents, however large the position. */
const MIN_FRACTION_DIGITS = 2;

/**
 * How far a fresh read may sit *behind* the projection before we believe it.
 * Between blocks the projection legitimately runs ahead of what the chain
 * reports; a withdrawal moves the balance by far more than a few ticks.
 */
const DRIFT_TOLERANCE_TICKS = 10;

export type AccruingValue = {
  /** The projected amount. Equals the input amount when accrual isn't live. */
  value: number;
  /**
   * Decimals to render, fixed-width. `undefined` when the value isn't accruing
   * (no rate, no position, still loading) — callers fall back to their static
   * formatting.
   */
  fractionDigits?: number;
};

/**
 * The decimal place whose last digit ticks about every `TARGET_TICK_MS`.
 *
 * A balance accrues `amount * ratePerSecond` per second, so the digit worth
 * `10^-d` turns over every `10^-d / (amount * ratePerSecond)` seconds. Solving
 * for the target cadence gives `d = -log10(amount * ratePerSecond * target)`.
 *
 * The cap is that same expression at **one whole unit** — the smallest position
 * we promise to animate visibly. Because `d` falls as the balance rises, any
 * amount at or above 1 already lands below the cap, so it only ever binds on
 * sub-unit dust (which then simply ticks slower than the target). At a 3.75%
 * SSR the cap works out to 9 decimals, and it re-derives itself if the rate
 * moves.
 */
export function pickFractionDigits(amount: number, ratePerSecond: number): number {
  const targetSeconds = TARGET_TICK_MS / 1000;
  const ideal = Math.round(-Math.log10(amount * ratePerSecond * targetSeconds));
  const cap = Math.round(-Math.log10(ratePerSecond * targetSeconds));
  return Math.max(MIN_FRACTION_DIGITS, Math.min(ideal, cap));
}

export function useAccruingValue({
  amount,
  ratePerSecond
}: {
  /** Last balance read from the chain, in whole token units. */
  amount?: number;
  /** Fractional growth per second (an SSR ray of 1.0000000011… → 1.1e-9). */
  ratePerSecond?: number;
}): AccruingValue {
  const isLive = amount !== undefined && amount > 0 && ratePerSecond !== undefined && ratePerSecond > 0;
  const fractionDigits = isLive ? pickFractionDigits(amount, ratePerSecond) : undefined;

  const [baseline, setBaseline] = useState<{ amount: number; at: number }>();
  const [projected, setProjected] = useState(amount ?? 0);
  // What the user is currently looking at, readable from the re-baseline effect
  // below without making it depend on (and so restart on) every tick.
  const displayed = useRef(amount ?? 0);

  // Re-baseline on a fresh read.
  useEffect(() => {
    if (amount === undefined) return;
    const tickSize = fractionDigits === undefined ? 0 : 10 ** -fractionDigits;
    const behind = displayed.current - amount;
    // Ignore a read that lands just short of what we've already shown: that's
    // the projection running ahead of the chain, and honouring it would count
    // the figure backwards. A real withdrawal clears the tolerance and lands.
    if (behind > 0 && behind < tickSize * DRIFT_TOLERANCE_TICKS) return;
    displayed.current = amount;
    setProjected(amount);
    setBaseline({ amount, at: Date.now() });
  }, [amount, fractionDigits]);

  // Tick.
  useEffect(() => {
    if (!isLive || !baseline || fractionDigits === undefined) return;

    // log1p/expm1 rather than the naive (1 + r)^t: r is ~1e-9, where the naive
    // form loses most of its significant digits to the leading 1.
    const logGrowth = Math.log1p(ratePerSecond);
    const scale = 10 ** fractionDigits;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const elapsed = (Date.now() - baseline.at) / 1000;
      const next = baseline.amount * Math.exp(logGrowth * elapsed);
      displayed.current = next;
      setProjected(next);

      // Wake exactly when the last rendered digit turns over, so this renders
      // once per visible change instead of on some arbitrary interval.
      const nextDigitValue = (Math.floor(next * scale) + 1) / scale;
      const nextElapsed = Math.log1p((nextDigitValue - baseline.amount) / baseline.amount) / logGrowth;
      const delay = baseline.at + nextElapsed * 1000 - Date.now();
      timer = setTimeout(tick, Math.max(delay, 16));
    };

    tick();
    return () => clearTimeout(timer);
  }, [isLive, baseline, ratePerSecond, fractionDigits]);

  return { value: isLive ? projected : (amount ?? 0), fractionDigits };
}
