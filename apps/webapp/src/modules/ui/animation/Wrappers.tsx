import { HTMLMotionProps, motion } from 'motion/react';
import { buttonsAnimations, cardAnimations, iconAnimations, positionAnimationsWithExit } from './presets';
import { AnimationLabels } from './constants';
import { forwardRef } from 'react';

export const CardAnimationWrapper = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ ...props }, ref) => (
    <motion.div
      variants={cardAnimations}
      initial={AnimationLabels.initial}
      animate={AnimationLabels.animate}
      exit={AnimationLabels.exit}
      ref={ref}
      {...props}
    />
  )
);

export const ButtonsAnimationWrapper = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ ...props }, ref) => (
    <motion.div
      variants={buttonsAnimations}
      initial={AnimationLabels.initial}
      animate={AnimationLabels.animate}
      exit={AnimationLabels.exit}
      ref={ref}
      {...props}
    />
  )
);

export const PositionAnimationWithExitWrapper = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ ...props }, ref) => (
    <motion.div
      variants={positionAnimationsWithExit}
      initial={AnimationLabels.initial}
      animate={AnimationLabels.animate}
      exit={AnimationLabels.exit}
      ref={ref}
      {...props}
    />
  )
);

export const IconAnimationWrapper = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ ...props }, ref) => (
    <motion.div
      variants={iconAnimations}
      initial={AnimationLabels.initial}
      animate={AnimationLabels.animate}
      exit={AnimationLabels.exit}
      ref={ref}
      {...props}
    />
  )
);
