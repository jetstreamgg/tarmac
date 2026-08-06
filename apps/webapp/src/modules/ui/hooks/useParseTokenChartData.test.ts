import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useParseTokenChartData } from './useParseTokenChartData';

const DAY = 86400;
const WEEK = 604800;

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
  // APP-456 #5: 1Y and All were flattened to seven equidistant points, so the
  // Total USDS and DAI chart drew a six-segment polyline while every other chart
  // plotted the real daily shape.
  it('samples 1Y weekly rather than collapsing it to seven points', () => {
    const points = parse('y', dailySeries(400));

    expect(points.length).toBeGreaterThan(50);
    expect(spacing(points)).toBe(WEEK);
  });

  it('samples All daily across the whole series', () => {
    const points = parse('all', dailySeries(400));

    expect(points.length).toBeGreaterThan(390);
    expect(spacing(points)).toBe(DAY);
  });

  it('keeps the short ranges on their existing daily cadence', () => {
    expect(spacing(parse('w', dailySeries(30)))).toBe(DAY);
    expect(spacing(parse('m', dailySeries(60)))).toBe(DAY);
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
