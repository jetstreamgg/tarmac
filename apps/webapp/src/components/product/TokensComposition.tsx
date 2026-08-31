import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LinkExternal } from '@/modules/icons';

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
  /** External URL — the hovered label becomes a link with an external-link glyph. */
  href?: string;
  /** Detail block revealed under the label while the row is hovered. */
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
 * DS Label 5 recipe and reveals its `hoverDetail`.
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
  const sum = valueTotal ?? segments.reduce((acc, s) => acc + s.value, 0);
  const share = (value: number) => (sum > 0 ? (value / sum) * 100 : 0);
  const fillOf = (segment: CompositionSegment) =>
    hoveredId === segment.id ? (segment.hoverColor ?? segment.color) : segment.color;
  const dimmed = (segment: CompositionSegment) => hoveredId !== null && hoveredId !== segment.id;

  // Slack left by segments that don't add up to the total — rendered as a
  // track-colored tail so the flex-grow ratios always sum to 100 (a total below
  // 1 makes the browser distribute only that fraction of the free space).
  const remainder = Math.max(0, 100 - segments.reduce((acc, s) => acc + share(s.value), 0));

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
        {remainder > 0 && (
          <div className="bg-chartTrack h-1.5 min-w-px" style={{ flex: `${remainder} 0 0` }} />
        )}
      </div>

      <div className="flex flex-col gap-4 pt-3" onMouseLeave={() => setHoveredId(null)}>
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
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex h-6 min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'size-1 shrink-0 rounded-full transition-[background-color,opacity] duration-150',
                      isDimmed && 'opacity-20'
                    )}
                    style={{ backgroundColor: fillOf(segment) }}
                  />
                  {isHovered ? (
                    <LabelLink href={segment.href}>{segment.label}</LabelLink>
                  ) : (
                    <span
                      className={cn(
                        'font-graphik truncate text-sm leading-[22px]',
                        isDimmed ? 'text-fgQuaternary' : 'text-fgSecondary'
                      )}
                    >
                      {segment.label}
                    </span>
                  )}
                  {segment.badge && <span className={cn(isDimmed && 'opacity-50')}>{segment.badge}</span>}
                </div>
                {isHovered && segment.hoverDetail}
              </div>
              <div
                className={cn(
                  'font-circle flex h-6 shrink-0 items-center gap-1.5 text-base leading-[18px] font-medium tracking-[-0.32px]',
                  isDimmed ? 'text-fgQuaternary' : 'text-text'
                )}
              >
                {segment.icon}
                {segment.formattedValue}
                <span
                  className={cn(
                    'font-graphik pt-0.5 text-sm leading-[22px] font-normal tracking-normal',
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

/** Hovered legend label — DS Label 5, with an external-link glyph when linkable. */
function LabelLink({ href, children }: { href?: string; children: ReactNode }) {
  const content = (
    <>
      <span className="truncate">{children}</span>
      {href && <LinkExternal boxSize={12} className="text-fgSecondary shrink-0" />}
    </>
  );
  const classes =
    'text-text font-circle flex min-w-0 items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px]';

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}
