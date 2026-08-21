import { cn } from '@/lib/cn';
import { formatUsd } from '@/utils';
import { RollingValue } from './rolling-value';

/**
 * A positive earnings/delta value with a leading `+` — only the `+` is in the
 * app's positive (bullish) green; the amount itself stays `text-text`
 * (e.g. <span class="text-bullish">+</span>$557.90). Defaults to USD
 * formatting; pass `format` to reuse the treatment for other units. Font
 * weight/size are left to the caller via `className`. `rolling` swaps the
 * figure for a `RollingValue` so a change rolls over instead of snapping.
 */
export function GainValue({
  value,
  format = formatUsd,
  className,
  rolling = false
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
  rolling?: boolean;
}) {
  const formatted = format(value);
  return (
    <span className={cn('text-text', className)} data-testid="gain-value">
      <span className="text-bullish">+</span>
      {rolling ? <RollingValue value={formatted} speed="stat" /> : formatted}
    </span>
  );
}
