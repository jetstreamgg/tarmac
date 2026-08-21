import { describe, expect, it } from 'vitest';

import { arcLengthAtX, buildArcLut, MeasurablePath } from './chartMotion';

/** A fake path whose x-at-arc-length is `xAt`. */
const fakePath = (total: number, xAt: (length: number) => number): MeasurablePath => ({
  getTotalLength: () => total,
  getPointAtLength: length => ({ x: xAt(length) })
});

describe('buildArcLut / arcLengthAtX', () => {
  it('returns no lut for a path that has not laid out (length 0)', () => {
    expect(buildArcLut(fakePath(0, () => 0))).toBeNull();
  });

  it('maps x back to arc length on a flat path (arc length == x)', () => {
    const lut = buildArcLut(fakePath(100, length => length))!;
    expect(lut.total).toBe(100);
    expect(arcLengthAtX(lut, 30)).toBeCloseTo(30, 5);
  });

  it('walks further along the stroke than along x on a steep path', () => {
    // Twice as much stroke as horizontal travel — a 45°-ish zigzag. The same
    // 30px of x is 60px of stroke, which is exactly what an x-space window
    // gets wrong on steep segments.
    const lut = buildArcLut(fakePath(200, length => length / 2))!;
    expect(arcLengthAtX(lut, 30)).toBeCloseTo(60, 5);
  });

  it('interpolates between samples', () => {
    const lut = buildArcLut(
      fakePath(100, length => length),
      4
    )!; // samples at x = 0/25/50/75/100
    expect(arcLengthAtX(lut, 37.5)).toBeCloseTo(37.5, 5);
  });

  it('clamps outside the plotted span', () => {
    const lut = buildArcLut(fakePath(100, length => length))!;
    expect(arcLengthAtX(lut, -10)).toBe(0);
    expect(arcLengthAtX(lut, 500)).toBe(100);
  });
});
