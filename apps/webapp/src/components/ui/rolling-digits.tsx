import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

const DIGIT = /\d/;

type KeyedCharacter = { key: string; character: string };

/**
 * Keys every character by what it is, not where it sits in the string. Digits
 * are keyed by place value — units, tens, tenths — so a carry that widens the
 * figure (`$9.86` → `$10.85`, `$990,000` → `$1,000,000`) leaves every existing
 * digit in the window it already occupies and mounts the new leading digit
 * fresh. Keying by string position instead would hand the `$` window a `1` and
 * roll the currency symbol into a digit, which reads as the whole figure
 * turning over. Separators get their own namespace so one can never inherit a
 * digit's window either.
 */
function keyCharacters(value: string, transition: DigitTransition, ids: string[] = []): KeyedCharacter[] {
  const characters = [...value];
  const point = characters.lastIndexOf('.');
  const integerEnd = point === -1 ? characters.length : point;
  let place = characters.slice(0, integerEnd).filter(character => DIGIT.test(character)).length;
  // A popped figure keys each digit by the identity it was given when it was
  // typed (`ids`, one per digit), so an edit anywhere in the string touches
  // only the digits it inserted or removed and the rest shift over in place.
  // Group commas are keyed by their order from the left, so a comma that only
  // shifts as the figure grows holds, and one that a new group brings pops in.
  let ordinal = 0;
  let comma = 0;

  return characters.map((character, index) => {
    if (!DIGIT.test(character)) {
      if (transition !== 'pop') return { key: `s${index}`, character };
      if (character === ',') {
        comma += 1;
        return { key: `c${comma}`, character };
      }
      return { key: `s${character}`, character };
    }
    if (transition === 'pop') {
      ordinal += 1;
      return { key: ids[ordinal - 1] ?? `o${ordinal}`, character };
    }
    // Counts down through the integer part to the units (0), then on through
    // the fraction (-1, -2 …), so the point never has to be special-cased.
    place -= 1;
    return { key: `d${place}`, character };
  });
}

const digitsOf = (value: string) => [...value].filter(character => DIGIT.test(character));

/**
 * Carries digit identities across an edit: the digits before and after the
 * edited run keep theirs, the run's digits are minted fresh from `next`.
 */
function carryIds(
  previous: string,
  value: string,
  ids: string[],
  next: number
): { ids: string[]; next: number } {
  const before = digitsOf(previous);
  const after = digitsOf(value);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const fresh = Array.from({ length: after.length - prefix - suffix }, (_, i) => `n${next + i}`);
  return {
    ids: [...ids.slice(0, prefix), ...fresh, ...(suffix ? ids.slice(ids.length - suffix) : [])],
    next: next + fresh.length
  };
}

/** `roll`: odometer (external changes). `pop`: a changed digit fades and scales in where it lands (typing). */
export type DigitTransition = 'roll' | 'pop';

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
export function RollingDigits({
  value,
  className,
  transition = 'roll',
  proportional = false
}: {
  value: string;
  className?: string;
  transition?: DigitTransition;
  /** Proportional figures instead of tabular: for an overlay that must share metrics with a native input. */
  proportional?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const root = useRef<HTMLSpanElement>(null);
  // Where each glyph sat after the last paint, keyed like the characters, so a
  // glyph a popped figure drops can fade out in the spot it occupied.
  const glyphs = useRef(new Map<string, HTMLSpanElement>());
  const leavers = useRef(new Map<string, HTMLSpanElement>());
  const lefts = useRef(new Map<string, number>());
  // A digit that mounts on a change is a carry and rolls up into its window;
  // the opening figure just shows. Derived during render, like the digits'
  // own roll state, so the carry rolls on the very commit that widens the figure.
  // `leaving`: glyphs a popped figure dropped (a backspace); they fade out
  // where they were, out of flow, then go once the animation ends.
  const [seen, setSeen] = useState({
    value,
    changed: false,
    leaving: [] as KeyedCharacter[],
    // Whether the last change removed glyphs: only then do the kept ones slide.
    slide: false,
    gen: 0,
    ids: digitsOf(value).map((_, index) => `o${index + 1}`),
    next: 0
  });
  let { ids } = seen;
  if (seen.value !== value) {
    const carried = carryIds(seen.value, value, seen.ids, seen.next);
    ids = carried.ids;
    const kept = new Set(keyCharacters(value, transition, ids).map(({ key }) => key));
    const leaving =
      transition === 'pop' && !prefersReducedMotion
        ? keyCharacters(seen.value, transition, seen.ids).filter(({ key }) => !kept.has(key))
        : [];
    setSeen({
      value,
      changed: true,
      leaving,
      slide: leaving.length > 0,
      gen: seen.gen + 1,
      ids,
      next: carried.next
    });
  }
  useLayoutEffect(() => {
    // A leaving glyph is placed once, on mount, at the spot its key held
    // before this paint; later renders leave it be. Then the map is refreshed
    // for the next change.
    for (const [key, element] of leavers.current) {
      if (!element.style.left) element.style.left = `${lefts.current.get(key) ?? 0}px`;
    }
    const origin = root.current?.getBoundingClientRect().left ?? 0;
    const previous = lefts.current;
    lefts.current = new Map(
      [...glyphs.current].map(([key, element]) => [key, element.getBoundingClientRect().left - origin])
    );
    // A kept glyph that a delete moved slides from where it was to where it
    // is, so the figure visibly closes over the removed glyph as it fades.
    // Typing just shifts: a slide on every keystroke past a comma would wobble.
    if (transition !== 'pop' || prefersReducedMotion || !seen.slide) return;
    // Only the glyphs right of the cut close over it; the ones left of it
    // just regroup, as they do on a keystroke.
    const cut = Math.min(...seen.leaving.map(({ key }) => previous.get(key) ?? Infinity));
    for (const [key, left] of lefts.current) {
      const from = previous.get(key);
      if (from === undefined || from <= cut || Math.abs(from - left) < 0.5) continue;
      glyphs.current
        .get(key)
        ?.animate([{ transform: `translateX(${from - left}px)` }, { transform: 'none' }], {
          // In step with the pop-out fade, so the gap closes as the glyph goes.
          duration: 200,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
    }
  });
  const characters = keyCharacters(value, transition, ids);
  return (
    // Inline, not inline-flex: flex would drop the letter-spacing the hero
    // figure is tracked with.
    <span ref={root} data-testid="rolling-digits" className={cn('relative', className)}>
      {/* The digits are the only copy of the figure in the DOM — adjacent inline
          spans form one text run, so this still reads and copies as a single
          number. Only the glyph on its way out is hidden, so a roll in flight
          can't wedge a stale digit into the middle of it. */}
      {characters.map(({ key, character }) => (
        <RollingCharacter
          key={key}
          ref={element => {
            if (element) glyphs.current.set(key, element);
            else glyphs.current.delete(key);
          }}
          character={character}
          arrives={seen.changed}
          transition={transition}
          proportional={proportional}
        />
      ))}
      {seen.leaving.map(({ key, character }) => (
        <span
          key={`leave-${seen.gen}-${key}`}
          ref={element => {
            if (element) leavers.current.set(key, element);
            else leavers.current.delete(key);
          }}
          aria-hidden
          data-testid="rolling-digit-out"
          data-transition="pop"
          className="motion-safe:animate-digit-pop-out absolute top-0 inline-block select-none"
          onAnimationEnd={() =>
            setSeen(current => ({ ...current, leaving: current.leaving.filter(glyph => glyph.key !== key) }))
          }
        >
          {character}
        </span>
      ))}
    </span>
  );
}

function RollingCharacter({
  ref,
  character,
  arrives,
  transition,
  proportional
}: {
  ref: (element: HTMLSpanElement | null) => void;
  character: string;
  arrives: boolean;
  transition: DigitTransition;
  proportional: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState({
    current: character,
    previous: null as string | null,
    // An arriving digit starts past generation zero so it rolls in; there is
    // no outgoing glyph, so nothing rolls out ahead of it.
    gen: arrives ? 1 : 0
  });

  // Generation whose entrance has played. React moves a glyph's DOM node when a
  // separator lands beside it, and a moved node replays its CSS animation, so
  // the class comes off once it has run.
  const [played, setPlayed] = useState(-1);
  const animating = state.gen > 0 && played !== state.gen;

  if (state.current !== character) {
    // Derived during render: the roll has to start on the commit that paints the
    // new digit, which an effect would be a frame too late for.
    setState({
      current: character,
      // Nothing to roll out when motion is reduced — the outgoing glyph is only
      // ever visible while it animates away, so rendering it would leave it
      // stacked on top of its replacement.
      previous: prefersReducedMotion || transition === 'pop' ? null : state.current,
      gen: state.gen + 1
    });
  }

  // Separators sit between the windows rather than inside one. A comma or
  // point a popped figure brings pops in like a digit; a rolled one just shows.
  if (!DIGIT.test(state.current)) {
    const pops = arrives && transition === 'pop' && animating;
    return (
      <span
        ref={ref}
        data-testid={pops ? 'rolling-separator-in' : undefined}
        data-transition={pops ? transition : undefined}
        className={cn(pops && 'motion-safe:animate-digit-pop-in inline-block')}
        onAnimationEnd={() => setPlayed(state.gen)}
      >
        {state.current}
      </span>
    );
  }

  return (
    // `tabular-nums` keeps the window widths equal so the number doesn't shuffle
    // sideways as digits turn over. It goes on the digit windows, not the whole
    // figure: Circular's tabular feature also pads "$", "," and "." out to a
    // digit's width, which spaces a currency figure out like a spreadsheet.
    <span
      ref={ref}
      data-testid="rolling-digit"
      className={cn('relative inline-block [clip-path:inset(0)]', !proportional && 'tabular-nums')}
    >
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
        data-testid={animating ? 'rolling-digit-in' : undefined}
        data-transition={animating ? transition : undefined}
        className={cn(
          'inline-block',
          animating &&
            (transition === 'pop' ? 'motion-safe:animate-digit-pop-in' : 'motion-safe:animate-digit-roll-in')
        )}
        onAnimationEnd={() => setPlayed(state.gen)}
      >
        {state.current}
      </span>
    </span>
  );
}
