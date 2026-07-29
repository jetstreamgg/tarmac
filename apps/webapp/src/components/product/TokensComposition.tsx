import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
};

// Each pill tucks this far under its predecessor so only the predecessor's
// rounded cap + pageBackground ring shows over it — the DS "circular gap"
// joint (Figma tokens composition 5270:15661, APP-416).
const CAP_OVERLAP_PX = 6;

/**
 * DS "Charts / Tokens Composition" (Figma 5270:15609): an optional title +
 * total over a proportional stacked bar and a token legend, one row per token —
 * dot · name on the left, icon · amount · percent right-aligned, hairline
 * between rows. Presentational — the caller supplies colors, formatted amounts
 * and icons.
 *
 * Hovering the bar or a legend row recolors that segment with its
 * Charts-Hover value and dims the rest to 50%, mirroring the portfolio pie.
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
  const dimmed = (segment: CompositionSegment) =>
    hoveredId !== null && hoveredId !== segment.id ? 0.5 : 1;

  // Cumulative spans: pill i runs from its segment's start to its end, plus a
  // small tuck under pill i-1; earlier pills stack on top so their caps (with
  // the pageBackground ring) draw the joint gaps.
  let cursor = 0;
  const layers = segments.map(segment => {
    const start = cursor;
    cursor += share(segment.value) / 100;
    return { segment, start, end: cursor };
  });

  return (
    <div className={cn('flex flex-col gap-5', className)} data-testid={dataTestId}>
      {title && <div className="text-fgSecondary font-graphik text-sm leading-[22px]">{title}</div>}
      {total && (
        <div className="text-text font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
          {total}
        </div>
      )}

      {/* The tall wrapper leaves room for the joint rings. */}
      <div
        className="relative flex h-3.5 w-full items-center"
        onMouseLeave={() => setHoveredId(null)}
        aria-hidden
      >
        <div className="bg-bgTertiary absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full" />
        {layers.map(({ segment, start, end }, index) => (
          <div
            key={segment.id}
            data-testid="composition-segment"
            onMouseEnter={() => setHoveredId(segment.id)}
            className="ring-pageBackground absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ring-4 transition-[background-color,opacity] duration-150"
            style={{
              left: index === 0 ? 0 : `calc(${start * 100}% - ${CAP_OVERLAP_PX}px)`,
              width: index === 0 ? `${end * 100}%` : `calc(${(end - start) * 100}% + ${CAP_OVERLAP_PX}px)`,
              zIndex: layers.length - index,
              backgroundColor: fillOf(segment),
              opacity: dimmed(segment)
            }}
          />
        ))}
      </div>

      <div className="flex flex-col">
        {segments.map(segment => {
          const percent = Math.round(segment.percent ?? share(segment.value));
          return (
            <div
              key={segment.id}
              data-testid="composition-row"
              className="border-borderPrimary flex items-center justify-between gap-4 border-b py-2.5 transition-opacity duration-150 last:border-b-0"
              style={{ opacity: dimmed(segment) }}
              onMouseEnter={() => setHoveredId(segment.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span className="text-fgSecondary font-graphik flex items-center gap-2 text-sm leading-[22px]">
                <span
                  className="size-1.5 shrink-0 rounded-full transition-colors duration-150"
                  style={{ backgroundColor: fillOf(segment) }}
                />
                {segment.label}
              </span>
              <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px]">
                {segment.icon}
                {segment.formattedValue}
                <span className="text-fgSecondary font-graphik font-normal">({percent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
