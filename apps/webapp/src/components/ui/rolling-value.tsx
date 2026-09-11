import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, type Transition } from 'motion/react';
import { cn } from '@/lib/cn';
import { easeInRoll, easeOutSettle, springSettle } from '@/modules/ui/animation/timingFunctions';

/**
 * A figure that rolls over as a whole when its value changes (Figma
 * 1598:76582, the "number animation"): the old value slides up and out of the
 * line while the new one rises into it from below, and the box re-sizes
 * underneath so whatever sits after the figure glides to its new spot rather
 * than jumping. Contrast `RollingDigits`, which turns over one digit at a time
 * for a figure that ticks continuously.
 *
 * Travel is in em so the same component serves a 40px hero figure and a 16px
 * stat: the comp moves the outgoing glyph one line up (-40 at 40px, -20/-15 at
 * 16px) and floats the incoming one in from a little over half a line below.
 * `speed` picks the comp's clock for each: 600ms for a hero figure, 400ms for
 * a stat.
 *
 * Not yet adopted beyond the portfolio earnings card — wire it where a figure
 * swaps discretely (hover focus, filter change), never where it ticks.
 */
const SPEEDS = { hero: 0.6, stat: 0.4 } as const;
const OUT_Y = '-1em';
const IN_Y = '0.55em';
const REST_Y = '0em';

type RollState = {
  current: string;
  previous: string | null;
  /** Where the outgoing glyph starts from — the resting line, or wherever the
   * glyph it interrupts had got to. */
  outFrom: { y: string; opacity: number };
  gen: number;
};

export function RollingValue({
  value,
  className,
  speed = 'hero',
  instant = false
}: {
  value: string | number;
  className?: string;
  speed?: keyof typeof SPEEDS;
  /** Swap without rolling — for a burst of continuous updates (a slider
   * drag) where every roll would be interrupted mid-flight; discrete changes
   * roll again once it's off. */
  instant?: boolean;
}) {
  const text = String(value);
  const prefersReducedMotion = useReducedMotion();
  // The incoming glyph animates these shared motion values, so a roll that
  // interrupts another can read exactly where the half-risen glyph is and
  // start the outgoing one from there instead of snapping it to the baseline.
  const inY = useMotionValue(REST_Y);
  const inOpacity = useMotionValue(1);
  const [state, setState] = useState<RollState>({
    current: text,
    previous: null,
    outFrom: { y: REST_Y, opacity: 1 },
    gen: 0
  });

  if (state.current !== text) {
    // Derived during render: the roll has to start on the commit that paints
    // the new value, which an effect would be a frame too late for.
    setState({
      current: text,
      // Nothing to roll out when motion is reduced — the outgoing glyph is only
      // ever visible while it animates away.
      previous: prefersReducedMotion || instant ? null : state.current,
      outFrom: { y: inY.get(), opacity: inOpacity.get() },
      gen: state.gen + 1
    });
  }

  // The box follows the in-flow glyph's width. Measured with a ResizeObserver
  // on the glyph so a breakpoint font-size change re-sizes it too, not just a
  // value change. The first measurement lands without animating (there's no
  // previous width to come from); later ones glide on the settle curve.
  const [box, setBox] = useState<{ width: number | null; settled: boolean }>({ width: null, settled: false });
  const observer = useRef<ResizeObserver | null>(null);
  const glyphRef = useCallback((node: HTMLSpanElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    // `settled` flips once there's a width to glide from.
    const measure = () =>
      setBox(previous => ({ width: node.getBoundingClientRect().width, settled: previous.width !== null }));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);

  const duration = SPEEDS[speed];
  const animateWidth = box.settled && !prefersReducedMotion && !instant;
  const swap = prefersReducedMotion ? 0 : duration;
  const inTransition: Transition = {
    y: { duration: swap, ease: springSettle },
    opacity: { duration: swap, ease: springSettle }
  };
  const outTransition: Transition = {
    y: { duration: swap, ease: springSettle },
    opacity: { duration: swap * 0.93, ease: easeInRoll }
  };

  return (
    // `clip-path` rather than `overflow: hidden` so the inline-block keeps the
    // text baseline (a clipped inline-block takes its baseline from its bottom
    // margin edge). The bottom edge is let out a little: at a tight line-height
    // (the hero's `leading-none`) the box ends above the comma's tail. Width is
    // animated, not transitioned, because `auto` can't be transitioned in CSS;
    // it's only ever numeric after the first measure.
    <motion.span
      data-testid="rolling-value"
      className={cn(
        'relative inline-block align-baseline whitespace-nowrap [clip-path:inset(0_0_-0.15em)]',
        className
      )}
      initial={false}
      animate={box.width === null ? undefined : { width: box.width }}
      transition={{ width: { duration: animateWidth ? duration : 0, ease: easeOutSettle } }}
    >
      {state.previous !== null && (
        <motion.span
          key={`out-${state.gen}`}
          aria-hidden
          data-testid="rolling-value-out"
          // Out of the accessibility tree and the selection, so neither a screen
          // reader nor a copy taken mid-roll picks up the stale figure.
          className="absolute top-0 left-0 select-none"
          initial={state.outFrom}
          animate={{ y: OUT_Y, opacity: 0 }}
          transition={outTransition}
          onAnimationComplete={() => setState(current => ({ ...current, previous: null }))}
        >
          {state.previous}
        </motion.span>
      )}
      {/* In flow, so it sizes the box and sets its baseline. Re-keyed per roll
          so the entrance replays from its initial offset instead of
          continuing from wherever the last one ended. */}
      <motion.span
        key={`in-${state.gen}`}
        ref={glyphRef}
        data-testid={state.gen > 0 ? 'rolling-value-in' : undefined}
        className="inline-block"
        style={{ y: inY, opacity: inOpacity }}
        initial={state.gen > 0 && !prefersReducedMotion && !instant ? { y: IN_Y, opacity: 0 } : false}
        animate={{ y: REST_Y, opacity: 1 }}
        transition={inTransition}
      >
        {state.current}
      </motion.span>
    </motion.span>
  );
}
