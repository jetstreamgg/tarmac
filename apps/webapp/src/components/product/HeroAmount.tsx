import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

/** Heading-2 (Figma): Circular 44/48, -0.88px tracking — the comps' hero size. */
const MAX_PX = 44;
/**
 * Below this the hero reads as body copy next to the 14px USD sub-line. At 20px
 * the narrowest slot (360px viewport, `stUSDS` badge) still shows ten figures,
 * so the ellipsis is unreachable for any real amount.
 */
const MIN_PX = 20;

/**
 * The largest font size at which `neededPx` fits `availablePx`, floored at
 * `minPx`. Both widths must be read at `maxPx`. Returns `maxPx` when the element
 * is unmeasurable — detached, hidden, or server-rendered — so the comps' size is
 * what renders unless a measurement proves it does not fit.
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
 * The hero amount shared by every review, status and reward row (Figma
 * 1310:130565 / 1036:205513 / 1036:190085). Renders at Heading-2 and shrinks to
 * fit rather than truncating, because these screens are what the user confirms
 * before signing — a smaller amount is legible, an elided one is not (APP-541).
 *
 * Both widths come off the element itself: with `truncate` in play `clientWidth`
 * is the width flexbox granted it and `scrollWidth` is the width the digits want,
 * so the ratio holds whatever the surrounding row or column contains. They are
 * only comparable at one font size, hence the reset to `MAX_PX` before each read.
 *
 * The fitted size is written straight to the node rather than held in state. The
 * class supplies the comps size, the inline style overrides it, and React manages
 * neither — so a re-render cannot clobber a measurement, and measuring cannot
 * cascade a render. `leading` and `tracking` are ratios, so both follow the size
 * down (1.0909 × 44px is the comps' 48px line box).
 */
export function HeroAmount({
  amount,
  className,
  testId
}: {
  amount: string;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = `${MAX_PX}px`;
      el.style.fontSize = `${fitFontSize({ neededPx: el.scrollWidth, availablePx: el.clientWidth })}px`;
    };
    fit();

    // The parent is content-sized, so once the amount shrinks the parent shrinks
    // with it and stops tracking the viewport — a parent-only observer never sees
    // the window widen again and the fit ratchets down for good. The window
    // listener is what restores the size; the observer catches the rest (a modal
    // opening, a sibling resizing) without waiting for a viewport change.
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
  }, [amount]);

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
