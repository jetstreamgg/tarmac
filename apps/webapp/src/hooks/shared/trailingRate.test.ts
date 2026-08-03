import { describe, expect, it } from 'vitest';
import { trailingAverageRate } from './trailingRate';

const point = (rate: number, timestampSec: number) => ({ rate, timestampSec });

describe('trailingAverageRate', () => {
  it('averages the whole series when it is shorter than the window', () => {
    expect(trailingAverageRate([point(0.03, 1), point(0.05, 2)])).toBeCloseTo(0.04);
  });

  it('averages only the most recent `days` points', () => {
    // 2 old points at 4%, then 30 recent ones at 10% — only the 30 count.
    const points = [
      point(0.04, 1),
      point(0.04, 2),
      ...Array.from({ length: 30 }, (_, i) => point(0.1, i + 3))
    ];
    expect(trailingAverageRate(points)).toBeCloseTo(0.1);
  });

  it('sorts oldest→newest before slicing, so source ordering is irrelevant', () => {
    const ascending = Array.from({ length: 40 }, (_, i) => point(i < 10 ? 0.01 : 0.05, i));
    const descending = [...ascending].reverse();
    expect(trailingAverageRate(descending)).toBeCloseTo(trailingAverageRate(ascending)!);
    expect(trailingAverageRate(ascending)).toBeCloseTo(0.05);
  });

  it('honours a custom window', () => {
    const points = [point(0.02, 1), point(0.04, 2), point(0.06, 3)];
    expect(trailingAverageRate(points, 2)).toBeCloseTo(0.05);
  });

  it('ignores non-finite rates', () => {
    expect(trailingAverageRate([point(NaN, 1), point(0.04, 2)])).toBeCloseTo(0.04);
  });

  it('returns undefined for an empty series', () => {
    expect(trailingAverageRate([])).toBeUndefined();
    expect(trailingAverageRate([point(NaN, 1)])).toBeUndefined();
  });
});
