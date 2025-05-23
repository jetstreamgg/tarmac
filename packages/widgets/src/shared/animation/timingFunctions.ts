import { cubicBezier } from 'framer-motion';

export const easeOutExpo = cubicBezier(0.16, 1, 0.03, 1);
export const easeInOutExpo = cubicBezier(0.87, 0, 0.13, 1);
export const bezierSkeleton = cubicBezier(0.61, 0, 0.39, 1);
export const bezierIconIn = cubicBezier(0.27, -0.18, 0.18, 0.96);
export const bezierIconOut = cubicBezier(0.16, 0.17, 0.36, 1.19);
