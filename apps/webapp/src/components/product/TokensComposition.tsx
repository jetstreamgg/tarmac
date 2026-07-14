import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CompositionSegment = {
  id: string;
  /** Token name shown in the legend, e.g. "stUSDS". */
  label: ReactNode;
  /** Segment + legend-dot color (any CSS color / token). */
  color: string;
  /** Raw magnitude — drives the segment's share of the bar. */
  value: number;
  /** Pre-formatted amount for the legend, e.g. "$19.92M". */
  formattedValue: ReactNode;
  /** Optional token logo shown before the amount. */
  icon?: ReactNode;
  /** Display percentage; defaults to the value's share of the total. */
  percent?: number;
};

/**
 * DS "Charts / Tokens Composition" (Figma 5270:15611): an optional title +
 * total over a proportional stacked bar and a token legend
 * (dot · name … icon · amount · percent). Presentational — the caller supplies
 * colors, formatted amounts, and icons.
 */
export function TokensComposition({
  title,
  total,
  segments,
  className
}: {
  title?: ReactNode;
  total?: ReactNode;
  segments: CompositionSegment[];
  className?: string;
}) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const share = (value: number) => (sum > 0 ? (value / sum) * 100 : 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {title && <div className="text-textSecondary text-sm">{title}</div>}
      {total && <div className="text-text text-2xl font-semibold">{total}</div>}

      <div className="flex h-1.5 w-full gap-0.5" aria-hidden>
        {segments.map(segment => (
          <span
            key={segment.id}
            className="h-full rounded-full"
            style={{ width: `${share(segment.value)}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>

      <div className="flex flex-col">
        {segments.map(segment => {
          const percent = Math.round(segment.percent ?? share(segment.value));
          return (
            <div
              key={segment.id}
              className="border-textSecondary/10 flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0"
            >
              <span className="text-textSecondary flex items-center gap-2 text-sm">
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
              <span className="text-text flex items-center gap-1.5 text-sm font-medium">
                {segment.icon}
                {segment.formattedValue}
                <span className="text-textSecondary font-normal">({percent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
