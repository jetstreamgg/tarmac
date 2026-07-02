import { describe, expect, it } from 'vitest';
import { computeMaturityWindow } from './maturityWindow';

const DAY = 86_400;

describe('computeMaturityWindow', () => {
  it('reports elapsed percentage over the real window when start is known', () => {
    const start = 1_000_000;
    const expiry = start + 100 * DAY;
    const now = start + 85 * DAY;

    const window = computeMaturityWindow({ expirySec: expiry, startSec: start, nowSec: now });

    expect(window.pct).toBeCloseTo(85);
    expect(window.remainingSeconds).toBe(15 * DAY);
  });

  it('falls back to a 180-day window when the start is unknown', () => {
    const expiry = 2_000_000_000;
    const now = expiry - 90 * DAY;

    const window = computeMaturityWindow({ expirySec: expiry, nowSec: now });

    expect(window.pct).toBeCloseTo(50);
    expect(window.remainingSeconds).toBe(90 * DAY);
  });

  it('clamps to 100% with zero remaining after maturity', () => {
    const start = 1_000_000;
    const expiry = start + 10 * DAY;

    const window = computeMaturityWindow({ expirySec: expiry, startSec: start, nowSec: expiry + DAY });

    expect(window.pct).toBe(100);
    expect(window.remainingSeconds).toBe(0);
  });

  it('clamps to 0% before the window opens', () => {
    const start = 1_000_000;
    const expiry = start + 10 * DAY;

    const window = computeMaturityWindow({ expirySec: expiry, startSec: start, nowSec: start - DAY });

    expect(window.pct).toBe(0);
    expect(window.remainingSeconds).toBe(11 * DAY);
  });
});
