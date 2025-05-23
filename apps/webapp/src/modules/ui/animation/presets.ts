import { Transition, Variant, Variants } from 'framer-motion';
import { bezierSkeleton, easeOutExpo } from './timingFunctions';
import { AnimationLabels } from './constants';

const cardInInitial: Variant = {
  opacity: 0,
  y: 20
};

const cardInAnimate: Variant = {
  opacity: 1,
  y: 0,
  transition: {
    y: { duration: 0.83, ease: easeOutExpo, delay: 0.1 },
    opacity: { duration: 0.5, ease: easeOutExpo, delay: 0.1 },
    // In order to implement the line-by-line animation on children of the card, the children we want to
    // stagger need to use variants with the same names as the parent (e.g. "initial" and "animate").
    staggerChildren: 0.03,
    delayChildren: 0.03
  }
};

const cardOutExit: Variant = {
  opacity: 0,
  y: -20,
  transition: {
    y: { duration: 0.83, ease: easeOutExpo },
    opacity: { duration: 0.35, ease: easeOutExpo }
  }
};

export const cardAnimations: Variants = {
  [AnimationLabels.initial]: cardInInitial,
  [AnimationLabels.animate]: cardInAnimate,
  [AnimationLabels.exit]: cardOutExit
};

export const skeletonTransition: Transition = {
  duration: 2.5,
  repeat: Infinity,
  ease: bezierSkeleton,
  repeatDelay: 0.5
};

const positionInitial: Variant = {
  y: 10,
  opacity: 0
};

const positionAnimate: Variant = {
  y: 0,
  opacity: 1,
  transition: {
    y: { duration: 0.83, ease: easeOutExpo },
    opacity: { duration: 0.5, ease: easeOutExpo },
    staggerChildren: 0.03,
    delayChildren: 0.03
  }
};

export const positionAnimations: Variants = {
  [AnimationLabels.initial]: positionInitial,
  [AnimationLabels.animate]: positionAnimate
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
