import { TimeFrame } from '@/modules/ui/components/Chart';

const DAY = 86400;
const HOUR = 3600;

/**
 * Sampling interval, in seconds, for each timeframe.
 *
 * Figma 2376:225261 asks for finer sampling so the plotted shape follows the
 * data instead of a handful of straight runs: "every 4 hours for a week, every
 * day for a month, and every 3 days for a year".
 *
 * Only 1Y moved. Every chart feed in the app — `overall/historic/`, the
 * savings, stUSDS and rewards series — publishes one row per calendar day, and
 * the sampler step-holds the last known value rather than interpolating. So a
 * sub-daily interval cannot add detail: it repeats each day's value six times
 * and draws the series as a staircase. 1W and 1M therefore stay daily, which
 * is already one sample per real record.
 *
 * 1Y is the case where the data was actually being thrown away: at a weekly
 * interval it plotted ~52 of the ~365 rows it had. Three days keeps ~120 real
 * records and the movement they carry, without running a year to 365 points.
 */
export const getTimeFrameInterval = (timeFrame: TimeFrame): number => {
  switch (timeFrame) {
    case 'w':
    case 'm':
    case 'all':
      return DAY;
    case 'y':
      return 3 * DAY;
    default:
      return HOUR;
  }
};
