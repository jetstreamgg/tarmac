import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { cn } from '@/lib/cn';
import { LinkExternal } from '@/modules/icons';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import { rowCollapseAnimations } from '@/modules/ui/animation/presets';
import { easeInOutQuart } from '@/modules/ui/animation/timingFunctions';

/**
 * The hover detail rides the table filter's collapse variants (height 0 ⇄ auto
 * + fade on in-out quart) but on a hover-length clock: 300ms is right for a
 * filter you clicked, too slow for a row the pointer merely crossed — a quick
 * drag down the legend would leave a train of half-open panels behind it.
 */
const DETAIL_REVEAL_MS = 200;
const detailRevealTransition: Transition = { duration: DETAIL_REVEAL_MS / 1000, ease: easeInOutQuart };

export type CompositionSegment = {
  id: string;
  /** Token name shown in the legend, e.g. "stUSDS". */
  label: ReactNode;
  /** Segment + legend-dot color (any CSS color / token). */
  color: string;
  /** Hovered fill (DS Components/Charts-Hover); defaults to `color`. */
  hoverColor?: string;
  /** Raw magnitude — drives the segment's share of the bar. */
  value: number;
  /** Pre-formatted amount for the legend, e.g. "$19.92M". */
  formattedValue: ReactNode;
  /** Optional token logo shown before the amount. */
  icon?: ReactNode;
  /** Display percentage; defaults to the value's share of the total. */
  percent?: number;
  /** Chip rendered after the label in every state (e.g. a "Merkl" badge). */
  badge?: ReactNode;
  /** External URL — the label is a link (always mounted, so it's reachable by
   * keyboard and a single tap); hovering/focusing adds the external-link glyph. */
  href?: string;
  /** Detail block revealed under the label while the row is hovered or focused. */
  hoverDetail?: ReactNode;
};

/**
 * DS "Charts / Tokens Composition" (Figma 2682:68829, hover 2682:68931): an
 * optional title + total over a proportional stacked bar and a token legend —
 * dot · name on the left, icon · amount · percent right-aligned, hairline
 * between rows. Presentational — the caller supplies colors, formatted amounts
 * and icons.
 *
 * The bar is a single clipped `rounded-full` flex row, so only its outer edges
 * are rounded and the joints are plain 2px gaps — the previous build stacked
 * individually-rounded pills behind a `pageBackground` ring, which painted a
 * light bar over glass surfaces and left the last pill overlapping the track.
 *
 * Legend rows are ordered by amount descending, independently of the bar order
 * (callers keep the bar in allocation order and let idle capital sit last).
 *
 * Hovering the bar or a legend row lifts that segment to its Charts-Hover fill
 * and drops the rest to 20%; the hovered legend row switches its label to the
 * DS Label 5 recipe and reveals its `hoverDetail`. Keyboard focus inside a row
 * (its market link) activates the same state, and the state clears when the
 * pointer or focus leaves that row — not the column, so the gaps between rows
 * don't hold a stale hover.
 *
 * The detail grows and shrinks rather than popping: an instant mount moved
 * every row below it by the panel's height in a single frame, which read as
 * the whole legend jumping under a fast drag. Text colours fade on the same
 * 150ms as the bar and dots; the label's face swap (Body 5 → Label 5) can't
 * tween and stays instant.
 */
export function TokensComposition({
  title,
  total,
  segments,
  valueTotal,
  className,
  dataTestId
}: {
  title?: ReactNode;
  total?: ReactNode;
  segments: CompositionSegment[];
  /** Denominator for the shares; defaults to the sum of the segment values.
   * Pass it when the segments deliberately leave the bar short (e.g. a vault
   * whose reported total exceeds its allocations). */
  valueTotal?: number;
  className?: string;
  dataTestId?: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const detailTransition: Transition = reduceMotion ? { duration: 0 } : detailRevealTransition;
  const sum = valueTotal ?? segments.reduce((acc, s) => acc + s.value, 0);
  const share = (value: number) => (sum > 0 ? (value / sum) * 100 : 0);
  const fillOf = (segment: CompositionSegment) =>
    hoveredId === segment.id ? (segment.hoverColor ?? segment.color) : segment.color;
  const dimmed = (segment: CompositionSegment) => hoveredId !== null && hoveredId !== segment.id;

  // Slack left by segments that don't add up to the total — rendered as a
  // track-colored tail so the flex-grow ratios always sum to 100 (a total below
  // 1 makes the browser distribute only that fraction of the free space).
  // Shares are floats (e.g. three thirds sum to 99.99999999999999), so anything
  // under a hundredth of a percent is residue, not a tail — without the epsilon
  // it painted a 1px track dot after the last segment.
  const remainder = Math.max(0, 100 - segments.reduce((acc, s) => acc + share(s.value), 0));
  const hasTail = remainder > 0.01;

  // Legend order is amount-descending regardless of the bar order.
  const legend = [...segments].sort((a, b) => b.value - a.value);

  return (
    <div className={cn('flex flex-col gap-5', className)} data-testid={dataTestId}>
      {title && <div className="text-fgSecondary font-graphik text-sm leading-[22px]">{title}</div>}
      {total && (
        <div className="text-text font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
          {total}
        </div>
      )}

      <div
        className="flex w-full gap-0.5 overflow-hidden rounded-full"
        onMouseLeave={() => setHoveredId(null)}
        aria-hidden
      >
        {segments.map(segment => (
          <div
            key={segment.id}
            data-testid="composition-segment"
            onMouseEnter={() => setHoveredId(segment.id)}
            className={cn(
              'h-1.5 min-w-px transition-[background-color,opacity] duration-150',
              dimmed(segment) && 'opacity-20'
            )}
            style={{ flex: `${share(segment.value)} 0 0`, backgroundColor: fillOf(segment) }}
          />
        ))}
        {hasTail && (
          <div
            data-testid="composition-track"
            className="bg-chartTrack h-1.5 min-w-px"
            style={{ flex: `${remainder} 0 0` }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 pt-3">
        {legend.map(segment => {
          const percent = Math.round(segment.percent ?? share(segment.value));
          const isHovered = hoveredId === segment.id;
          const isDimmed = dimmed(segment);
          return (
            <div
              key={segment.id}
              data-testid="composition-row"
              className="border-borderPrimary flex items-start justify-between gap-4 border-b pb-3 last:border-b-0"
              onMouseEnter={() => setHoveredId(segment.id)}
              onMouseLeave={() => setHoveredId(null)}
              // Focus bubbles in React, so the row's link focusing counts as a hover.
              onFocus={() => setHoveredId(segment.id)}
              onBlur={() => setHoveredId(null)}
            >
              {/* No gap on the column: a gap would survive the detail's height 0
                  and jump. The 12px sits inside the clip (pt-3) instead. */}
              <div className="flex min-w-0 flex-col">
                <div className="flex min-h-6 min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'size-1 shrink-0 rounded-full transition-[background-color,opacity] duration-150',
                      isDimmed && 'opacity-20'
                    )}
                    style={{ backgroundColor: fillOf(segment) }}
                  />
                  <Label href={segment.href} active={isHovered} dimmed={isDimmed}>
                    {segment.label}
                  </Label>
                  {segment.badge && <span className={cn(isDimmed && 'opacity-50')}>{segment.badge}</span>}
                </div>
                <AnimatePresence initial={false}>
                  {isHovered && segment.hoverDetail && (
                    <motion.div
                      key="detail"
                      data-testid="composition-detail"
                      className="overflow-hidden"
                      variants={rowCollapseAnimations}
                      initial={AnimationLabels.initial}
                      animate={AnimationLabels.animate}
                      exit={AnimationLabels.exit}
                      transition={detailTransition}
                    >
                      <div className="pt-3">{segment.hoverDetail}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div
                className={cn(
                  'font-circle flex h-6 shrink-0 items-center gap-1.5 text-base leading-[18px] font-medium tracking-[-0.32px] transition-colors duration-150',
                  isDimmed ? 'text-fgQuaternary' : 'text-text'
                )}
              >
                {segment.icon}
                {segment.formattedValue}
                <span
                  className={cn(
                    'font-graphik pt-0.5 text-sm leading-[22px] font-normal tracking-normal transition-colors duration-150',
                    isDimmed ? 'text-fgQuaternary' : 'text-fgSecondary'
                  )}
                >
                  ({percent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Legend label. Resting: DS Body 5 in fgSecondary. Active (hovered/focused):
 * DS Label 5 in text, plus an external-link glyph when linkable. The `<a>` is
 * mounted in both states so keyboard users can Tab to it and a touch tap opens
 * it directly. The text truncates from `sm` up; below that (a 335px column on a
 * phone) a long label — the idle row's savings-rate sentence — wraps instead of
 * hiding the figure it exists to show.
 */
function Label({
  href,
  active,
  dimmed,
  children
}: {
  href?: string;
  active: boolean;
  dimmed: boolean;
  children: ReactNode;
}) {
  const classes = cn(
    'flex min-w-0 items-center gap-1.5 text-sm transition-colors duration-150',
    active
      ? 'text-text font-circle leading-4 font-medium tracking-[-0.28px]'
      : cn('font-graphik leading-[22px]', dimmed ? 'text-fgQuaternary' : 'text-fgSecondary')
  );
  const content = (
    <>
      <span className="min-w-0 sm:truncate">{children}</span>
      {href && active && <LinkExternal boxSize={12} className="text-fgSecondary shrink-0" />}
    </>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}
