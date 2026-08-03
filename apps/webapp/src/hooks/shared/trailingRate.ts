/**
 * One point of a daily rate series, normalized: a decimal-fraction rate
 * (0.045 = 4.50%) at a unix-seconds timestamp.
 */
export type DailyRatePoint = {
  rate: number;
  timestampSec: number;
};

/**
 * Trailing average of a daily rate series — the "30D Rate" every earn surface
 * shows. No source exposes a dedicated 30-day figure, so each one hands us its
 * daily series and we average the most recent `days` points.
 *
 * Points are sorted oldest→newest first, so the window is correct regardless of
 * the source's ordering. Series shorter than `days` are averaged over whatever
 * exists (a two-week-old vault reports a 14-point average, not a dash) —
 * matching what the product detail pages have always done. Returns undefined
 * only when there is nothing to average.
 *
 * Every consumer (marketplace table + product detail pages) must go through
 * this function so a row and its detail page can never disagree.
 */
export function trailingAverageRate(
  points: readonly DailyRatePoint[],
  days: number = 30
): number | undefined {
  const finite = points.filter(point => Number.isFinite(point.rate));
  if (finite.length === 0) return undefined;

  const window = [...finite].sort((a, b) => a.timestampSec - b.timestampSec).slice(-days);
  return window.reduce((sum, point) => sum + point.rate, 0) / window.length;
}
