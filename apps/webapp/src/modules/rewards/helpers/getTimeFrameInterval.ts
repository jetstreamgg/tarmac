import { TimeFrame } from '@/modules/ui/components/Chart';

const HOUR = 3600;
const DAY = 86400;

/**
 * Sampling interval, in seconds, for each timeframe.
 *
 * Figma 2376:225261 asks for finer sampling so the plotted shape follows the
 * data instead of a handful of straight runs: "every 4 hours for a week, every
 * day for a month, and every 3 days for a year". 1W and 1Y both tightened —
 * 1Y in particular was sampling weekly, so it drew ~52 points over a year of
 * daily records and flattened most of the movement away.
 *
 * All-time keeps the daily interval: at 3 days it loses shape, and at anything
 * finer a six-year range runs to thousands of points.
 */
export const getTimeFrameInterval = (timeFrame: TimeFrame): number => {
  switch (timeFrame) {
    case 'w':
      return 4 * HOUR;
    case 'm':
    case 'all':
      return DAY;
    case 'y':
      return 3 * DAY;
    default:
      return HOUR;
  }
};

/** Median gap between consecutive timestamps, or 0 for a series too short to have one. */
const medianCadence = (timestamps: number[]): number => {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps = sorted
    .slice(1)
    .map((t, i) => t - sorted[i])
    .filter(gap => gap > 0)
    .sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
};

/** Fewest segments a plot may be reduced to, however sparse the feed is. */
const MIN_SEGMENTS = 6;

/**
 * The interval a series should actually be sampled at: the timeframe's, but
 * never finer than the source's own cadence.
 *
 * Sampling below the source cadence does not add detail — the interpolator
 * step-holds the last known value, so asking for 4-hourly points from a feed
 * that publishes once a day just repeats each value six times and draws the
 * series as a staircase. The BA Labs `overall/historic/` endpoint behind the
 * Portfolio statistics chart is exactly that: one row per day. Charts fed from
 * the indexer, whose rows are per-event, do get the finer sampling.
 *
 * Cadence is measured from the records that fall *inside* the window, and the
 * result is capped so the window always keeps at least `MIN_SEGMENTS` samples.
 * Both guards matter: callers prepend the last record from before the window
 * (so the plot starts at the right level), and on a sparse series that leading
 * gap can be months wide — left in, it would set the interval wider than the
 * whole window and collapse the chart to a single point, which draws no line
 * at all.
 */
export const resolveSampleInterval = (
  timeFrame: TimeFrame,
  timestamps: number[],
  startTimestamp: number,
  endTimestamp: number
): number => {
  const base = getTimeFrameInterval(timeFrame);
  const inWindow = timestamps.filter(t => t >= startTimestamp && t <= endTimestamp);
  const interval = Math.max(base, medianCadence(inWindow));

  const window = endTimestamp - startTimestamp;
  if (window <= 0) return interval;
  // Never cap below `base` — a sparse feed must not be upsampled back into the
  // staircase the cadence floor exists to prevent.
  return Math.min(interval, Math.max(base, window / MIN_SEGMENTS));
};
