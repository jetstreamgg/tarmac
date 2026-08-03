import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

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
    <span className={cn('tabular-nums', className)}>
      {/* One reading of the whole figure for assistive tech — the per-digit
          boxes below would otherwise be announced a character at a time. No
          live region: this changes about once a second. */}
      <span className="sr-only">{value}</span>
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
    return <span aria-hidden>{state.current}</span>;
  }

  return (
    <span aria-hidden data-testid="rolling-digit" className="relative inline-block [clip-path:inset(0)]">
      {state.previous !== null && (
        <span
          key={`out-${state.gen}`}
          data-testid="rolling-digit-out"
          className="motion-safe:animate-digit-roll-out absolute inset-x-0 top-0"
          onAnimationEnd={() => setState(current => ({ ...current, previous: null }))}
        >
          {state.previous}
        </span>
      )}
      {/* In flow, so it sizes the window and sets its baseline; the roll is a
          transform, which costs no layout. */}
      <span
        key={`in-${state.gen}`}
        data-testid={state.gen > 0 ? 'rolling-digit-in' : undefined}
        className={cn('block', state.gen > 0 && 'motion-safe:animate-digit-roll-in')}
      >
        {state.current}
      </span>
    </span>
  );
}
