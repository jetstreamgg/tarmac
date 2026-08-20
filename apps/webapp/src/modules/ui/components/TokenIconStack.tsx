import { Children, ComponentPropsWithoutRef, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { easeOutOvershoot } from '../animation/timingFunctions';
import { TokenIcon } from './TokenIcon';

/**
 * Design-system "Badges / Set" (Figma 5034:22071): a row of circular badges,
 * each overlapping the previous by a third of its width. Every badge carries a
 * ring in the page background color — not the surface it sits on — so the
 * front badge reads as a punched-out circle over the one behind it, and the
 * cluster keeps a consistent halo on any card or panel. The FIRST badge is the
 * front one (the comp stacks z-3 → z-1 left to right), so each badge's ring
 * cuts into the badge to its right.
 *
 * `IconStack` is the generic stack (chain icons, custom-keyed TokenIcons, …);
 * size children with `h-full w-full`. `TokenIconStack` is the Figma set's
 * Type=Tokens flavour, building the stack from plain token symbols.
 */
export type IconStackEntrance = {
  /** Seconds before the first badge pops in. */
  delay?: number;
  /** Seconds between consecutive badges (the comp: 0.1). */
  stagger?: number;
};

// Badge pop-in (Figma 2233:61099, "crypto-logos" instances): scale 0 → 1 on
// the overshoot curve over 200ms, one badge after the other.
const POP_DURATION = 0.2;
const POP_STAGGER = 0.1;

export function IconStack({
  size,
  className,
  children,
  animateIn,
  ...props
}: {
  /** Badge diameter in px; the overlap and ring scale off it. */
  size: number;
  children: ReactNode;
  /** Pop the badges in one after another on mount (the pie-card entrance). */
  animateIn?: IconStackEntrance;
} & ComponentPropsWithoutRef<'span'>) {
  const prefersReducedMotion = useReducedMotion();
  const badges = Children.toArray(children);
  const pop = animateIn && !prefersReducedMotion;
  return (
    <span className={cn('flex items-center', className)} {...props}>
      {/* `relative` lifts each badge (ring + icon) into the positioned paint
          phase: the icons inside are positioned, so without it every icon
          paints above every ring and the punched-out cut never shows. The
          descending z-index puts the left badge in front. */}
      {badges.map((child, index) => (
        <motion.span
          key={index}
          className="ring-pageBackground relative inline-flex shrink-0 rounded-full ring-[1.5px]"
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -size / 3,
            zIndex: badges.length - index
          }}
          initial={pop ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{
            duration: POP_DURATION,
            ease: easeOutOvershoot,
            delay: (animateIn?.delay ?? 0) + index * (animateIn?.stagger ?? POP_STAGGER)
          }}
        >
          {child}
        </motion.span>
      ))}
    </span>
  );
}

export function TokenIconStack({
  symbols,
  size = 24,
  className,
  ...props
}: {
  symbols: string[];
  /** Badge diameter in px (Figma size M = 24). */
  size?: number;
} & ComponentPropsWithoutRef<'span'>) {
  return (
    <IconStack size={size} className={className} {...props}>
      {symbols.map(symbol => (
        <TokenIcon
          key={symbol}
          token={{ symbol }}
          width={size}
          showChainIcon={false}
          className="h-full w-full"
        />
      ))}
    </IconStack>
  );
}
