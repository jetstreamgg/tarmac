import { cn } from '@/lib/cn';
import { skeletonTransition } from '@/modules/ui/animation/presets';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The app's only loading placeholder (Figma Portfolio/Skeleton loader
 * 1881:51588). Every block that stands in for content while it loads renders
 * this — the ad-hoc `animate-pulse` divs and the `bg-card`/`bg-surface`/
 * `bg-textSecondary` track overrides that used to sit beside it are gone, so
 * the track color is no longer a per-call-site decision.
 *
 * `className` is still the sizing/radius API (`h-4 w-20`, `rounded-full`, …);
 * it just no longer carries the palette. Under reduced motion the sweep is
 * dropped and the track alone marks the pending region.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('bg-skeletonTrack h-6 overflow-hidden rounded-md', className)} {...props}>
      {!reduceMotion && (
        <motion.span
          className="from-skeletonSweep/0 via-skeletonSweep to-skeletonSweep/0 block h-full w-[200%] bg-linear-to-r from-0% to-100% opacity-90"
          animate={{ x: ['-100%', '50%'] }}
          transition={skeletonTransition}
        />
      )}
    </div>
  );
}

export { Skeleton };
