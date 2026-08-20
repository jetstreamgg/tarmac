import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useParseTokenChartData } from './useParseTokenChartData';

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
  // 2376:225261 then tightened 1Y again, from weekly to 3-daily, so it plots
  // ~120 of the ~365 rows it has instead of ~52.
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

  // 1W stays daily. Every chart feed publishes one row per day and the sampler
  // step-holds, so a sub-daily interval would repeat each value rather than add
  // detail — it drew the week as a six-tread staircase.
  it('samples 1W daily', () => {
    expect(spacing(parse('w', dailySeries(30)))).toBe(DAY);
  });

  // A series whose only records sit outside (or barely inside) the window still
  // has to plot a line, not a lone point.
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
