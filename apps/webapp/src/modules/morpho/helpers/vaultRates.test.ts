import { describe, expect, it } from 'vitest';
import { trailing30DayRate } from './vaultRates';

describe('trailing30DayRate', () => {
  it('averages the apy of the trailing 30 points', () => {
    const points = Array.from({ length: 45 }, (_, i) => ({ apy: i < 15 ? 0.1 : 0.04 }));
    // Last 30 are all 0.04.
    expect(trailing30DayRate(points)).toBeCloseTo(0.04);
  });

  it('averages all points when there are fewer than 30', () => {
    expect(trailing30DayRate([{ apy: 0.03 }, { apy: 0.05 }])).toBeCloseTo(0.04);
  });

  it('ignores points without an apy', () => {
    expect(trailing30DayRate([{ apy: 0.05 }, {}, { apy: 0.03 }])).toBeCloseTo(0.04);
  });

  it('returns undefined when no point has an apy', () => {
    expect(trailing30DayRate([{}, {}])).toBeUndefined();
  });

  it('takes the most recent points regardless of input ordering', () => {
    // Newest-first input; the recent 2 points (apy 0.04) should win, not the old 0.1.
    const points = [
      { apy: 0.04, blockTimestamp: 300 },
      { apy: 0.04, blockTimestamp: 200 },
      ...Array.from({ length: 40 }, (_, i) => ({ apy: 0.1, blockTimestamp: 100 - i }))
    ];
    // Last 30 by timestamp are all 0.04 / 0.1 mix — the 2 newest are 0.04, rest 0.1.
    // Average of the 30 most-recent: 2×0.04 + 28×0.1.
    expect(trailing30DayRate(points)).toBeCloseTo((2 * 0.04 + 28 * 0.1) / 30);
  });
});
