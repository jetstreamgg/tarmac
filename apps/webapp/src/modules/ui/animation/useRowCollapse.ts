import { Transition, useReducedMotion } from 'motion/react';
import { rowCollapseTransition } from './presets';

/**
 * The motion half of the table filter collapse (Figma 1598:77060): the
 * element-level transition for the collapse variants — instant under
 * prefers-reduced-motion. One hook so the desktop table cells and the mobile
 * cards can't drift.
 */
export function useRowCollapseTransition(): Transition {
  const reduceMotion = useReducedMotion();
  return reduceMotion ? { duration: 0 } : rowCollapseTransition;
}

/**
 * The CSS half, for the row surface: the corner-radius/margin handoff between
 * an exiting edge row and its survivor must ride the same clock and curve as
 * the collapse itself. The 300ms values ARE `ROW_COLLAPSE_MS` and the timing
 * function IS `easeInOutQuart` — Tailwind only extracts literal class
 * strings, so they're spelled out; keep them in sync by hand.
 * Background-color keeps the primitive's original 150ms hover feel, and is
 * the only property still transitioned under prefers-reduced-motion (a color
 * fade isn't motion).
 */
export const ROW_SURFACE_TRANSITION_CLASSES =
  'transition-[background-color,border-radius,margin] [transition-duration:150ms,300ms,300ms] [transition-timing-function:var(--default-transition-timing-function),var(--ease-in-out-quart),var(--ease-in-out-quart)] motion-reduce:transition-[background-color]';
