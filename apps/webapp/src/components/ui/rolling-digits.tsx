import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * Splits a formatted integer into a still `head` and the trailing `digits`
 * digit characters, for a figure whose whole part should roll only at its
 * low end: "1,234,567" → head "1,234,5", tail "67". The count is of digits,
 * not characters, so a grouping separator that lands inside the tail travels
 * with it (RollingDigits renders separators as bare spans anyway). A figure
 * shorter than the tail is all tail.
 */
export function splitRollingTail(formatted: string, digits = 2): { head: string; tail: string } {
  let seen = 0;
  let index = formatted.length;
  while (index > 0 && seen < digits) {
    index -= 1;
    if (/\d/.test(formatted[index])) seen += 1;
  }
  return { head: formatted.slice(0, index), tail: formatted.slice(index) };
}

/**
 * Odometer digits (Figma 1598:76444). Each character sits in its own one-line
 * clip window; when a digit changes, the old glyph slides up and out of the
 * window while its replacement rises into it from below.
 *
 * The window clips with `clip-path` rather than `overflow: hidden` on purpose:
 * an inline-block with a non-visible overflow takes its baseline from its bottom
 * margin edge, which would drop the figure off the baseline it shares with the
 * rest of the number. `clip-path` clips the paint and leaves the baseline alone.
 */
export function RollingDigits({ value, className }: { value: string; className?: string }) {
  const characters = [...value];

  return (
    // Inline, not inline-flex: flex would drop the letter-spacing the hero
    // figure is tracked with. `tabular-nums` keeps the box widths equal so the
    // number doesn't shuffle sideways as digits turn over.
    <span data-testid="rolling-digits" className={cn('tabular-nums', className)}>
      {/* The digits are the only copy of the figure in the DOM — adjacent inline
          spans form one text run, so this still reads and copies as a single
          number. Only the glyph on its way out is hidden, so a roll in flight
          can't wedge a stale digit into the middle of it. */}
      {characters.map((character, index) => (
        // Keyed from the right, so a carry (999 → 1,000) leaves every existing
        // digit in the box it already occupies instead of shifting them along.
        <RollingCharacter key={characters.length - index} character={character} />
      ))}
    </span>
  );
}

function RollingCharacter({ character }: { character: string }) {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState({ current: character, previous: null as string | null, gen: 0 });

  if (state.current !== character) {
    // Derived during render: the roll has to start on the commit that paints the
    // new digit, which an effect would be a frame too late for.
    setState({
      current: character,
      // Nothing to roll out when motion is reduced — the outgoing glyph is only
      // ever visible while it animates away, so rendering it would leave it
      // stacked on top of its replacement.
      previous: prefersReducedMotion ? null : state.current,
      gen: state.gen + 1
    });
  }

  // Separators sit between the windows rather than inside one.
  if (!/\d/.test(state.current)) {
    return <span>{state.current}</span>;
  }

  return (
    <span data-testid="rolling-digit" className="relative inline-block [clip-path:inset(0)]">
      {state.previous !== null && (
        <span
          key={`out-${state.gen}`}
          aria-hidden
          data-testid="rolling-digit-out"
          // Out of the accessibility tree and out of the selection, so neither a
          // screen reader nor a copy taken mid-roll picks up the stale digit.
          className="motion-safe:animate-digit-roll-out absolute inset-x-0 top-0 select-none"
          onAnimationEnd={() => setState(current => ({ ...current, previous: null }))}
        >
          {state.previous}
        </span>
      )}
      {/* In flow, so it sizes the window and sets its baseline; the roll is a
          transform, which costs no layout. It has to be a box for the transform
          to apply at all, and specifically an inline-block one: Chrome's
          selection serialiser puts a newline after every block-level box, which
          would copy the figure out one digit per line. */}
      <span
        key={`in-${state.gen}`}
        data-testid={state.gen > 0 ? 'rolling-digit-in' : undefined}
        className={cn('inline-block', state.gen > 0 && 'motion-safe:animate-digit-roll-in')}
      >
        {state.current}
      </span>
    </span>
  );
}
