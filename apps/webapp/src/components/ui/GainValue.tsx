import { cn } from '@/lib/cn';
import { formatUsd } from '@/utils';
import { RollingValue } from './rolling-value';

/** Below this, a value is float-arithmetic noise, not money — treat as zero. */
const NOISE_EPSILON = 1e-6;

/**
 * Magnitude formatting shared by GainValue and the plain earnings figures:
 * noise below NOISE_EPSILON collapses to a true zero, and real sub-cent
 * amounts render as `<$0.01` instead of posing as a flat `$0.00` (a ~$0.04
 * position's earnings are real, just smaller than the 2dp display).
 */
export function formatGainMagnitude(value: number, format: (value: number) => string = formatUsd): string {
  const magnitude = Math.abs(value);
  if (magnitude < NOISE_EPSILON) return format(0);
  if (magnitude < 0.005) return `<${format(0.01)}`;
  return format(magnitude);
}

/** True only for a real (non-noise) negative value. */
export function isGainNegative(value: number): boolean {
  return value <= -NOISE_EPSILON;
}

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
  signed = false,
  className,
  rolling = false
}: {
  value: number;
  format?: (value: number) => string;
  /** Negative values render a red `-` instead of the green `+` (APP-450). */
  signed?: boolean;
  className?: string;
  rolling?: boolean;
}) {
  const negative = signed && isGainNegative(value);
  const formatted = formatGainMagnitude(value, format);
  return (
    <span className={cn('text-text', className)} data-testid="gain-value">
      <span className={negative ? 'text-error' : 'text-bullish'}>{negative ? '-' : '+'}</span>
      {rolling ? <RollingValue value={formatted} speed="stat" /> : formatted}
    </span>
  );
}
