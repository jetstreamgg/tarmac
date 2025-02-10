import { Transition, Variant, Variants } from 'framer-motion';
import { bezierSkeleton, easeOutExpo } from './timingFunctions';
import { AnimationLabels } from './constants';

export const skeletonTransition: Transition = {
  duration: 2.5,
  repeat: Infinity,
  ease: bezierSkeleton,
  repeatDelay: 0.5
};

const fadeInInitial: Variant = {
  opacity: 0
};

const fadeInAnimate: Variant = {
  opacity: 1,
  transition: {
    opacity: { duration: 0.25, ease: easeOutExpo },
    staggerChildren: 0.03,
    delayChildren: 0.03
  }
};

export const fadeAnimations: Variants = {
  [AnimationLabels.initial]: fadeInInitial,
  [AnimationLabels.animate]: fadeInAnimate
};
