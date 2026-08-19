import { cn } from '@/lib/cn';
import { formatUsd } from '@/utils';

/**
 * A positive earnings/delta value with a leading `+` — only the `+` is in the
 * app's positive (bullish) green; the amount itself stays `text-text`
 * (e.g. <span class="text-bullish">+</span>$557.90). Defaults to USD
 * formatting; pass `format` to reuse the treatment for other units. Font
 * weight/size are left to the caller via `className`.
 */
export function GainValue({
  value,
  format = formatUsd,
  signed = false,
  className
}: {
  value: number;
  format?: (value: number) => string;
  /** Negative values render a red `-` instead of the green `+` (APP-450). */
  signed?: boolean;
  className?: string;
}) {
  const negative = signed && value < 0;
  return (
    <span className={cn('text-text', className)} data-testid="gain-value">
      <span className={negative ? 'text-error' : 'text-bullish'}>{negative ? '-' : '+'}</span>
      {format(Math.abs(value))}
    </span>
  );
}
