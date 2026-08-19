import { describe, expect, it } from 'vitest';
import { monthToDateWindow } from './monthWindow';

// Externally anchored epoch: 2026-08-01T00:00:00Z, verified against the APP-450
// spike (Morpho timestamp_gte probe). Every other expected value below is
// derived from it (or from Jan 1 anchors) with visible arithmetic — never from
// the code under test.
const AUG_1_2026 = 1785542400;
const DAY = 86400;
const JUL_1_2026 = AUG_1_2026 - 31 * DAY; // July has 31 days
const SEP_1_2026 = AUG_1_2026 + 31 * DAY; // August has 31 days
// Jan 1 2026 00:00Z = 1767225600 (Jan 1 2025 = 1735689600 + 365d; 2025 common year)
const JAN_1_2027 = 1767225600 + 365 * DAY; // 2026 is a common year
// 2028 is a leap year; Feb 1 2028 = Jan 1 2028 + 31d; Jan 1 2028 = Jan 1 2027 + 365d
const FEB_1_2028 = JAN_1_2027 + 365 * DAY + 31 * DAY;

describe('monthToDateWindow', () => {
  it('anchors startSec to the 1st of the month at 00:00 UTC', () => {
    // 2026-08-19T12:00:00Z = Aug 1 + 18 days + 12 hours
    const nowMs = (AUG_1_2026 + 18 * DAY + 12 * 3600) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({
      startSec: AUG_1_2026,
      endSec: AUG_1_2026 + 18 * DAY + 12 * 3600
    });
  });

  it('returns an empty-but-valid window exactly at the month boundary', () => {
    const window = monthToDateWindow(AUG_1_2026 * 1000);
    expect(window).toEqual({ startSec: AUG_1_2026, endSec: AUG_1_2026 });
  });

  it('keeps the last second of the 31st inside the old month', () => {
    // 2026-08-31T23:59:59Z = Sep 1 − 1s
    const nowMs = (SEP_1_2026 - 1) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({ startSec: AUG_1_2026, endSec: SEP_1_2026 - 1 });
  });

  it('rolls the window at month start (Jul 31 23:59:59Z is still July)', () => {
    const julyWindow = monthToDateWindow((AUG_1_2026 - 1) * 1000);
    expect(julyWindow.startSec).toBe(JUL_1_2026);

    const augustWindow = monthToDateWindow(AUG_1_2026 * 1000);
    expect(augustWindow.startSec).toBe(AUG_1_2026);
  });

  it('handles the year rollover', () => {
    // 2027-01-01T00:00:30Z
    const nowMs = (JAN_1_2027 + 30) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({ startSec: JAN_1_2027, endSec: JAN_1_2027 + 30 });
  });

  it('handles leap-year February', () => {
    // 2028-02-29T00:00:00Z = Feb 1 2028 + 28 days (leap year has a 29th)
    const nowMs = (FEB_1_2028 + 28 * DAY) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({ startSec: FEB_1_2028, endSec: FEB_1_2028 + 28 * DAY });
  });

  it('truncates sub-second precision toward the past', () => {
    const nowMs = AUG_1_2026 * 1000 + 999; // 0.999s past the boundary
    expect(monthToDateWindow(nowMs).endSec).toBe(AUG_1_2026);
  });
});
