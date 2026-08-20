import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useParseTokenChartData } from './useParseTokenChartData';

const HOUR = 3600;
const DAY = 86400;

/** `days` daily points ending now, oldest first, at 1e18 per unit. */
const dailySeries = (days: number) => {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: days }, (_, i) => ({
    blockTimestamp: now - (days - 1 - i) * DAY,
    amount: BigInt(days - i) * 10n ** 18n,
    holders: 0
  }));
};

const parse = (timeFrame: 'w' | 'm' | 'y' | 'all', series: ReturnType<typeof dailySeries>) =>
  renderHook(() => useParseTokenChartData(timeFrame, series)).result.current;

/** Median gap between consecutive points, in seconds. */
const spacing = (points: { date: Date }[]) => {
  const gaps = points.slice(1).map((p, i) => (p.date.getTime() - points[i].date.getTime()) / 1000);
  return gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
};

describe('useParseTokenChartData', () => {
  // APP-456 #5 rescued 1Y and All from seven equidistant points; Figma
  // 2376:225261 then asked for finer sampling still — "every 4 hours for a
  // week, every day for a month, and every 3 days for a year".
  it('samples 1Y every three days', () => {
    const points = parse('y', dailySeries(400));

    expect(points.length).toBeGreaterThan(100);
    expect(spacing(points)).toBe(3 * DAY);
  });

  it('samples All daily across the whole series', () => {
    const points = parse('all', dailySeries(400));

    expect(points.length).toBeGreaterThan(390);
    expect(spacing(points)).toBe(DAY);
  });

  it('samples 1M daily', () => {
    expect(spacing(parse('m', dailySeries(60)))).toBe(DAY);
  });

  // The 4-hourly 1W interval only buys detail when the feed has it. BA Labs
  // publishes `overall/historic/` once a day, and the interpolator step-holds,
  // so upsampling it drew the week as a six-tread staircase instead of a line.
  it('does not sample 1W below the feed cadence', () => {
    expect(spacing(parse('w', dailySeries(30)))).toBe(DAY);
  });

  it('samples 1W every four hours when the feed is finer than that', () => {
    const now = Math.floor(Date.now() / 1000);
    const hourly = Array.from({ length: 200 }, (_, i) => ({
      blockTimestamp: now - (199 - i) * HOUR,
      amount: BigInt(200 - i) * 10n ** 18n,
      holders: 0
    }));

    expect(spacing(parse('w', hourly))).toBe(4 * HOUR);
  });

  // The callers prepend the last record from *before* the window so the plot
  // starts at the right level. Measuring cadence over that leading gap set the
  // interval wider than the window itself and collapsed the chart to a single
  // point, which recharts draws as no line at all.
  it('does not collapse a sparse series to a single point', () => {
    const now = Math.floor(Date.now() / 1000);
    const sparse = [
      { blockTimestamp: now - 180 * DAY, amount: 1n * 10n ** 18n, holders: 0 },
      { blockTimestamp: now - 3 * DAY, amount: 2n * 10n ** 18n, holders: 0 }
    ];

    expect(parse('w', sparse).length).toBeGreaterThanOrEqual(6);
  });

  it('still marks a min and a max on the long ranges', () => {
    const points = parse('all', dailySeries(400));

    expect(points.filter(p => p.isMin)).toHaveLength(1);
    expect(points.filter(p => p.isMax)).toHaveLength(1);
  });

  it('returns an empty series for no data', () => {
    expect(parse('all', [])).toEqual(expect.any(Array));
  });
});
