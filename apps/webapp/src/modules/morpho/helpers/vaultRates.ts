import { trailingAverageRate } from '@/hooks';

/** A chart point carrying a net APY (decimal fraction) and its day timestamp. */
type RatePoint = { apy?: number; blockTimestamp?: number };

/**
 * Trailing 30-day average net rate for a vault, derived from the daily chart
 * series. Adapts the vault chart's point shape onto `trailingAverageRate`, the
 * one implementation every "30D Rate" surface shares (the marketplace table
 * reads the same average for this vault). Points without an apy are ignored;
 * returns undefined when there is nothing to average.
 */
export function trailing30DayRate(points: RatePoint[]): number | undefined {
  return trailingAverageRate(
    points.flatMap(point =>
      typeof point.apy === 'number' ? [{ rate: point.apy, timestampSec: point.blockTimestamp ?? 0 }] : []
    )
  );
}
