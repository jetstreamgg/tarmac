import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
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
 *
 * Not yet adopted beyond the portfolio earnings card — wire it where a figure
 * swaps discretely (hover focus, filter change), never where it ticks.
 */
export function RollingValue({
  value,
  className,
  duration = 0.6
}: {
  value: string;
  className?: string;
  /** Seconds for the glyph swap; the width settles on the same clock. */
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState({ current: value, previous: null as string | null, gen: 0 });

  if (state.current !== value) {
    // Derived during render: the roll has to start on the commit that paints
    // the new value, which an effect would be a frame too late for.
    setState({
      current: value,
      // Nothing to roll out when motion is reduced — the outgoing glyph is only
      // ever visible while it animates away.
      previous: prefersReducedMotion ? null : state.current,
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

  const animateWidth = box.settled && !prefersReducedMotion;

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
    // margin edge). Width is animated, not transitioned, because `auto` can't
    // be transitioned in CSS; it's only ever numeric after the first measure.
    <motion.span
      data-testid="rolling-value"
      className={cn('relative inline-block align-baseline whitespace-nowrap [clip-path:inset(0)]', className)}
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
          initial={{ y: '0em', opacity: 1 }}
          animate={{ y: '-1em', opacity: 0 }}
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
        initial={state.gen > 0 && !prefersReducedMotion ? { y: '0.55em', opacity: 0 } : false}
        animate={{ y: '0em', opacity: 1 }}
        transition={inTransition}
      >
        {state.current}
      </motion.span>
    </motion.span>
  );
}
