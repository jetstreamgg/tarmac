/** A chart point carrying a net APY (decimal fraction) and its day timestamp. */
type RatePoint = { apy?: number; blockTimestamp?: number };

/**
 * Trailing 30-day average net rate for a vault, derived from the daily chart
 * series (no dedicated 30D endpoint exists — same trailing-average approach the
 * Savings "6M Rate" uses). `apy` is a decimal fraction (e.g. 0.0445). Points are
 * sorted oldest→newest so the most recent 30 days are taken regardless of the
 * source ordering; points without an apy are ignored. Returns undefined when
 * there is nothing to average.
 */
export function trailing30DayRate(points: RatePoint[]): number | undefined {
  const withApy = points.filter(
    (point): point is RatePoint & { apy: number } => typeof point.apy === 'number'
  );
  if (withApy.length === 0) return undefined;
  const sorted = [...withApy].sort((a, b) => (a.blockTimestamp ?? 0) - (b.blockTimestamp ?? 0));
  const last30 = sorted.slice(-30);
  return last30.reduce((sum, point) => sum + point.apy, 0) / last30.length;
}
