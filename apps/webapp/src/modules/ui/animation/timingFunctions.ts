import { cubicBezier, type Easing } from 'motion/react';

export const easeOutExpo = cubicBezier(0.16, 1, 0.03, 1);
export const bezierSkeleton = cubicBezier(0.61, 0, 0.39, 1);
export const easeInOutExpo = cubicBezier(0.87, 0, 0.13, 1);

// The curves the interaction comps are drawn on (Figma 2238:62221 loader,
// 2134:88604 menu, 1598:76582 number roll, 2233:61099 pie chart). They mirror
// the `--ease-*` tokens in globals.css for motion-driven code.
/** Springy overshoot for small things that pop or hop into place. */
export const easeOutOvershoot = cubicBezier(0.45, 1.45, 0.8, 1);
/** Plain settle for anything that resizes (textbook easeOutExpo). */
export const easeOutSettle = cubicBezier(0.16, 1, 0.3, 1);
/** Front-loaded leave used by the rolling number's outgoing glyph. */
export const easeInRoll = cubicBezier(0.55, 0, 1, 0.45);
/** Critically-damped spring, as Figma exports it for the rolling number: no
 * bounce, ~95% of the way by half time. Normalised to t ∈ [0, 1]. */
export const springSettle: Easing = t =>
  1 - Math.exp(-t * 11.1803) * (Math.cos(t * 0.1581) + 70.7054 * Math.sin(t * 0.1581));
