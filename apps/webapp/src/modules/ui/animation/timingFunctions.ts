import { cubicBezier } from 'motion/react';

export const easeOutExpo = cubicBezier(0.16, 1, 0.03, 1);
export const bezierSkeleton = cubicBezier(0.61, 0, 0.39, 1);
export const easeInOutExpo = cubicBezier(0.87, 0, 0.13, 1);
/** Mirrors the CSS `--ease-in-out-quart` token in globals.css. */
export const easeInOutQuart = cubicBezier(0.77, 0, 0.175, 1);
