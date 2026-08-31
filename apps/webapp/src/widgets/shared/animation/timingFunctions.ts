import { cubicBezier } from 'motion/react';

// Skeleton easing is defined once at the app level; re-exported so widgets code can
// keep importing it from this module.
export { bezierSkeleton } from '@/modules/ui/animation/timingFunctions';

export const easeOutExpo = cubicBezier(0.16, 1, 0.03, 1);
export const easeInOutExpo = cubicBezier(0.87, 0, 0.13, 1);
export const bezierIconIn = cubicBezier(0.27, -0.18, 0.18, 0.96);
export const bezierIconOut = cubicBezier(0.16, 0.17, 0.36, 1.19);
