import { Transition, Variant, Variants } from 'motion/react';
import { bezierIconIn, bezierIconOut, bezierSkeleton, easeInOutQuart, easeOutExpo } from './timingFunctions';
import { AnimationLabels } from './constants';

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

const positionOutExit: Variant = {
  y: -10,
  opacity: 0,
  transition: {
    y: { duration: 0.83, ease: easeOutExpo },
    opacity: { duration: 0.5, ease: easeOutExpo }
  }
};

export const positionAnimations: Variants = {
  [AnimationLabels.initial]: positionInitial,
  [AnimationLabels.animate]: positionAnimate
};

export const positionAnimationsWithExit: Variants = {
  ...positionAnimations,
  [AnimationLabels.exit]: positionOutExit
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

/** Table filter collapse (Figma 1598:77060) — one duration for the motion and
 * for every hold that must outlive it (e.g. keeping a section mounted so its
 * exits can finish). */
export const ROW_COLLAPSE_MS = 300;

export const rowCollapseTransition: Transition = {
  duration: ROW_COLLAPSE_MS / 1000,
  ease: easeInOutQuart
};

/**
 * A filtered row collapses to nothing and fades as it goes; a row the filter
 * re-admits plays the same thing backwards. All affected rows move in unison —
 * the comp has no stagger. `height: 'auto'` lets one variant set serve both
 * the fixed-height table cells and the variable-height mobile cards; the
 * element carrying it must be `overflow-hidden` and hold no vertical
 * padding/margin of its own (those would survive height 0).
 */
export const rowCollapseAnimations: Variants = {
  [AnimationLabels.initial]: { height: 0, opacity: 0 },
  [AnimationLabels.animate]: { height: 'auto', opacity: 1 },
  [AnimationLabels.exit]: { height: 0, opacity: 0 }
};

/**
 * Label-only variants for the row container (`motion.tr`): AnimatePresence
 * needs the labels on its direct child to propagate enter/exit into the cell
 * wrappers, but the row itself must not move — and must not reuse
 * fadeAnimations, whose staggerChildren would break the comp's no-stagger rule.
 */
export const rowCollapseContainerAnimations: Variants = {
  [AnimationLabels.initial]: {},
  [AnimationLabels.animate]: {},
  [AnimationLabels.exit]: {}
};

export const cardInInitial: Variant = {
  opacity: 0,
  y: 20
};

export const cardInAnimate: Variant = {
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

const buttonsInInitial: Variant = {
  scale: 0.93,
  opacity: 0
};

const buttonsInAnimate: Variant = {
  scale: 1,
  opacity: 1,
  transition: {
    scale: { duration: 0.35, ease: easeOutExpo, delay: 0.07 },
    opacity: { duration: 0.35, ease: easeOutExpo, delay: 0.07 }
  }
};

const buttonsOutExit: Variant = {
  opacity: 0,
  transition: {
    opacity: { duration: 0.25, ease: easeOutExpo }
  }
};

export const buttonsAnimations: Variants = {
  [AnimationLabels.initial]: buttonsInInitial,
  [AnimationLabels.animate]: buttonsInAnimate,
  [AnimationLabels.exit]: buttonsOutExit
};

const iconInInitial: Variant = {
  scale: 1.12,
  opacity: 0
};

const iconInAnimate: Variant = {
  scale: 1,
  opacity: 1,
  transition: {
    scale: { duration: 0.18, ease: bezierIconIn },
    opacity: { duration: 0.35, ease: bezierIconIn }
  }
};

const iconOutExit: Variant = {
  scale: 1.12,
  opacity: 0,
  transition: {
    scale: { duration: 0.18, ease: bezierIconOut },
    opacity: { duration: 0.25, ease: bezierIconOut }
  }
};

export const iconAnimations: Variants = {
  [AnimationLabels.initial]: iconInInitial,
  [AnimationLabels.animate]: iconInAnimate,
  [AnimationLabels.exit]: iconOutExit
};
