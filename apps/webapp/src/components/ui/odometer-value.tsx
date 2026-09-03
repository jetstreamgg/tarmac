import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * A figure that keeps animating under continuous change — the number-flow
 * idea (https://number-flow.barvian.me) done with our own primitives. Each
 * digit is a window onto a vertical 0–9 strip; a change retargets a spring on
 * the strip's transform, so a value that moves every frame (a slider drag)
 * glides through its digits instead of restarting a roll it never finishes.
 * Carries travel in the value's direction (…8, 9, 0… on the way up), and
 * characters that appear or vanish as the figure changes length — a new
 * leading digit, a grouping separator — fade in while their neighbours glide
 * to their new spots.
 *
 * Contrast `RollingValue` (whole-figure roll for a discrete swap) and
 * `RollingDigits` (one-shot per-digit roll for a figure that ticks once a
 * second). This one is for a figure the user drives.
 *
 * Takes the already-formatted string so the caller keeps its own formatter;
 * digits are identified by their place value (see `tokenizeFigure`) so the
 * units column stays the units column when the figure grows a digit.
 */
export function OdometerValue({ value, className }: { value: string; className?: string }) {
  const tokens = tokenizeFigure(value);
  // Proportional figures, not tabular: each digit window is sized to the
  // glyph it shows and its width animates on the same spring as the strip,
  // so "1" stays narrow and the figure keeps the typeface's own rhythm. The
  // ten glyph widths are measured off a hidden ruler in this very font
  // context, re-measured when the box resizes (a breakpoint font-size).
  const rulerRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  useLayoutEffect(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;
    const measure = () =>
      setWidths(previous => {
        const next = [...ruler.children].map(glyph => glyph.getBoundingClientRect().width);
        return previous && previous.every((width, index) => width === next[index]) ? previous : next;
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ruler);
    return () => observer.disconnect();
  }, []);
  const numeric = parseFigure(value);
  const previousNumeric = useRef(numeric);
  // The direction the figure is moving, so a carry travels the right way
  // (…8, 9, 0, 1… going up). Read during render from the last committed
  // value; equal values keep the previous direction.
  const trend = numeric === previousNumeric.current ? 0 : numeric > previousNumeric.current ? 1 : -1;
  const lastTrend = useRef(1);
  if (trend !== 0) lastTrend.current = trend;
  useEffect(() => {
    previousNumeric.current = numeric;
  });

  return (
    // `inline-flex` so the characters are layout-animatable boxes; each keeps
    // the inherited letter-spacing on its own glyph. The visible strips are
    // out of the accessibility tree and the selection — the sr-only copy is
    // what reads and copies.
    <span className={cn('relative inline-flex whitespace-nowrap', className)} data-testid="odometer-value">
      <span className="sr-only">{value}</span>
      <span ref={rulerRef} aria-hidden className="invisible absolute top-0 left-0 whitespace-nowrap">
        {Array.from({ length: 10 }, (_, digit) => (
          <span key={digit} className="inline-block">
            {digit}
          </span>
        ))}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        {tokens.map(token => (
          <motion.span
            key={token.key}
            layout="position"
            aria-hidden
            data-testid="odometer-char"
            className="inline-block select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {token.digit === undefined ? (
              token.character
            ) : (
              <DigitStrip digit={token.digit} trend={lastTrend.current} width={widths?.[token.digit]} />
            )}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

// The strip is periodic, so a carry can keep travelling past 9 (or before 0)
// and the strip snaps back a whole period once it settles — invisibly, since
// the glyph at row k and row k+10 is the same. Rows -10..19 cover any single
// travel from a settled row in [0, 10).
const STRIP_START = -10;
const STRIP_ROWS = 30;
// Critically damped: a drag retargets this every frame, and any bounce would
// read as the digit dithering.
const SPRING = { type: 'spring', duration: 0.75, bounce: 0 } as const;

function DigitStrip({ digit, trend, width }: { digit: number; trend: number; width?: number }) {
  const prefersReducedMotion = useReducedMotion();
  // Unwrapped row the strip is heading for; the motion value follows it.
  const target = useRef(digit);
  const row = useMotionValue(digit);
  const y = useTransform(row, r => `${-(r - STRIP_START)}lh`);

  useEffect(() => {
    const current = target.current;
    const settled = ((current % 10) + 10) % 10;
    if (settled === digit) return;
    // Nearest row showing `digit` in the direction the figure is moving.
    const next =
      trend >= 0 ? current + ((digit - settled + 10) % 10) : current - ((settled - digit + 10) % 10);
    target.current = next;
    if (prefersReducedMotion) {
      row.jump(next);
      return;
    }
    const controls = animate(row, next, {
      ...SPRING,
      onComplete: () => {
        // Snap back into the base period once at rest; a newer target has
        // already moved on if this isn't ours any more.
        if (target.current !== next) return;
        const normalized = ((next % 10) + 10) % 10;
        if (normalized !== next) {
          target.current = normalized;
          row.jump(normalized);
        }
      }
    });
    return () => controls.stop();
  }, [digit, trend, prefersReducedMotion, row]);

  return (
    // The invisible glyph sizes the window and sets its baseline; the strip
    // is absolutely positioned over it and clipped to the one line. `lh`
    // rows keep the strip's pitch equal to the window at any font size.
    // The window is clipped to its line box and softened at the top and
    // bottom edges so a glyph on its way out fades rather than being cut
    // flat; the fade stops short of where the figures sit at rest.
    <motion.span
      className="relative inline-block [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)] [clip-path:inset(0)]"
      initial={false}
      animate={width === undefined ? undefined : { width }}
      transition={prefersReducedMotion ? { duration: 0 } : SPRING}
    >
      <span className="invisible">{digit}</span>
      <motion.span className="absolute inset-x-0 top-0 text-center" style={{ y }}>
        {Array.from({ length: STRIP_ROWS }, (_, index) => {
          const r = STRIP_START + index;
          return (
            <span key={r} className="block h-[1lh]">
              {((r % 10) + 10) % 10}
            </span>
          );
        })}
      </motion.span>
    </motion.span>
  );
}

export type FigureToken = { key: string; character: string; digit?: number };

/**
 * Keys every character of a formatted figure by what it IS, not where it sits:
 * integer digits by place value from the decimal point (`i0` units, `i1`
 * tens…), grouping separators by the digits to their right (`is3`), fraction
 * digits by position after the point (`f0`, `f1`), the point itself `d`, and
 * anything before the first / after the last digit by index (`p0`, `s0`). So
 * when "$99,999.00" becomes "$100,000.00" every existing column keeps its key
 * (the separator still has three digits to its right) and only the new
 * leading digit mounts.
 */
export function tokenizeFigure(value: string): FigureToken[] {
  const characters = [...value];
  const firstDigit = characters.findIndex(isDigit);
  if (firstDigit === -1) return characters.map((character, index) => ({ key: `p${index}`, character }));
  let lastDigit = characters.length - 1;
  while (!isDigit(characters[lastDigit])) lastDigit -= 1;

  // The decimal point is the last non-digit inside the number that is NOT a
  // grouping separator (a separator is followed by exactly three digits and
  // then a non-digit or the end). formatUsd's "1,234.56" and a locale's
  // "1.234,56" both resolve.
  let point = -1;
  for (let index = lastDigit; index > firstDigit; index -= 1) {
    if (isDigit(characters[index])) continue;
    let run = 0;
    let cursor = index + 1;
    while (cursor <= lastDigit && isDigit(characters[cursor])) {
      run += 1;
      cursor += 1;
    }
    // Exactly three digits up to the next non-digit (or the end) makes it a
    // grouping separator; anything else, scanning from the right, is the point.
    if (run !== 3) {
      point = index;
      break;
    }
  }

  const tokens: FigureToken[] = [];
  characters.forEach((character, index) => {
    if (index < firstDigit) {
      tokens.push({ key: `p${index}`, character });
    } else if (index > lastDigit) {
      tokens.push({ key: `s${index - lastDigit - 1}`, character });
    } else if (index === point) {
      tokens.push({ key: 'd', character });
    } else if (point !== -1 && index > point) {
      const position = characters.slice(point + 1, index).filter(isDigit).length;
      tokens.push(
        isDigit(character)
          ? { key: `f${position}`, character, digit: Number(character) }
          : { key: `fs${position}`, character }
      );
    } else {
      const end = point === -1 ? lastDigit + 1 : point;
      const place = characters.slice(index + 1, end).filter(isDigit).length;
      tokens.push(
        isDigit(character)
          ? { key: `i${place}`, character, digit: Number(character) }
          : { key: `is${place}`, character }
      );
    }
  });
  return tokens;
}

/** The figure as a number, for the direction of travel; NaN if it has none. */
export function parseFigure(value: string): number {
  const tokens = tokenizeFigure(value);
  const negative = tokens.some(token => token.key.startsWith('p') && token.character === '-');
  const whole = tokens
    .filter(token => token.key.startsWith('i') && token.digit !== undefined)
    .map(token => token.character)
    .join('');
  const fraction = tokens
    .filter(token => token.key.startsWith('f') && token.digit !== undefined)
    .map(token => token.character)
    .join('');
  const magnitude = Number(`${whole || '0'}.${fraction || '0'}`);
  return negative ? -magnitude : magnitude;
}

const isDigit = (character: string) => /\d/.test(character);
