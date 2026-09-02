import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

/** Heading-2 (Figma): Circular 44/48 — the transaction heroes' size. */
const MAX_PX = 44;
/** Below this the amount reads as body copy; 20px still fits ten figures in the narrowest slot. */
const MIN_PX = 20;

/**
 * Largest size at which `neededPx` fits `availablePx`, floored at `minPx`; both
 * widths must be read at `maxPx`. Unmeasurable returns `maxPx`, so the comps' size
 * stands unless a measurement proves otherwise.
 */
export function fitFontSize({
  neededPx,
  availablePx,
  maxPx = MAX_PX,
  minPx = MIN_PX
}: {
  neededPx: number;
  availablePx: number;
  maxPx?: number;
  minPx?: number;
}): number {
  if (neededPx <= 0 || availablePx <= 0 || neededPx <= availablePx) return maxPx;
  return Math.min(maxPx, Math.max(minPx, Math.floor((maxPx * availablePx) / neededPx)));
}

/**
 * The amount on every review, status and reward row. Shrinks to fit instead of
 * truncating — the user signs off these screens, and a smaller number is legible
 * where an elided one is not (APP-541).
 *
 * `clientWidth` is what flexbox granted, `scrollWidth` what the digits want; the
 * two only compare at one size, hence the reset to `maxPx` before each read. The
 * result goes on the node rather than into state, so renders and measurements
 * can't cascade into each other.
 */
export function FittedAmount({
  amount,
  className,
  maxPx = MAX_PX,
  testId
}: {
  amount: string;
  className?: string;
  /** For callers whose comps draw below Heading-2. Pass the matching `text-*` class too. */
  maxPx?: number;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = `${maxPx}px`;
      el.style.fontSize = `${fitFontSize({ neededPx: el.scrollWidth, availablePx: el.clientWidth, maxPx })}px`;
    };
    fit();

    // The parent is content-sized, so it shrinks with the amount and stops tracking
    // the viewport: a parent-only observer would never see the window widen back and
    // the fit would ratchet down for good.
    window.addEventListener('resize', fit);
    const observer =
      typeof ResizeObserver === 'undefined' || !el.parentElement ? undefined : new ResizeObserver(fit);
    observer?.observe(el.parentElement!);
    // Circular loads after first paint; its metrics differ from the fallback stack.
    void document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      window.removeEventListener('resize', fit);
      observer?.disconnect();
    };
  }, [amount, maxPx]);

  return (
    <span
      ref={ref}
      className={cn(
        'font-circle text-fgPrimary block truncate text-[44px] leading-[1.0909] font-medium tracking-[-0.02em]',
        className
      )}
      data-testid={testId}
    >
      {amount}
    </span>
  );
}
