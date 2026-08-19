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
const FEB_1_2027 = JAN_1_2027 + 31 * DAY;
const DEC_1_2026 = JAN_1_2027 - 31 * DAY; // December has 31 days
// 2028 is a leap year; Feb 1 2028 = Jan 1 2028 + 31d; Jan 1 2028 = Jan 1 2027 + 365d
const FEB_1_2028 = JAN_1_2027 + 365 * DAY + 31 * DAY;
const MAR_1_2028 = FEB_1_2028 + 29 * DAY; // leap-year February has 29 days

describe('monthToDateWindow', () => {
  it('spans the whole calendar month in UTC', () => {
    // 2026-08-19T12:00:00Z = Aug 1 + 18 days + 12 hours
    const nowMs = (AUG_1_2026 + 18 * DAY + 12 * 3600) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({
      startSec: AUG_1_2026,
      endSec: SEP_1_2026 - 1
    });
  });

  it('is identical for any two instants inside the same month (refetch stability)', () => {
    const early = monthToDateWindow(AUG_1_2026 * 1000);
    const late = monthToDateWindow((SEP_1_2026 - 1) * 1000);
    expect(early).toEqual(late);
    expect(early).toEqual({ startSec: AUG_1_2026, endSec: SEP_1_2026 - 1 });
  });

  it('rolls the window at month start (Jul 31 23:59:59Z is still July)', () => {
    expect(monthToDateWindow((AUG_1_2026 - 1) * 1000)).toEqual({
      startSec: JUL_1_2026,
      endSec: AUG_1_2026 - 1
    });
    expect(monthToDateWindow(AUG_1_2026 * 1000).startSec).toBe(AUG_1_2026);
  });

  it('handles the year rollover in both bounds', () => {
    // 2026-12-15T00:00:00Z ends the window one second before Jan 1 2027
    expect(monthToDateWindow((DEC_1_2026 + 14 * DAY) * 1000)).toEqual({
      startSec: DEC_1_2026,
      endSec: JAN_1_2027 - 1
    });
    // 2027-01-01T00:00:30Z starts the new year's window
    expect(monthToDateWindow((JAN_1_2027 + 30) * 1000)).toEqual({
      startSec: JAN_1_2027,
      endSec: FEB_1_2027 - 1
    });
  });

  it('handles leap-year February', () => {
    // 2028-02-29T00:00:00Z = Feb 1 2028 + 28 days (leap year has a 29th)
    const nowMs = (FEB_1_2028 + 28 * DAY) * 1000;
    expect(monthToDateWindow(nowMs)).toEqual({ startSec: FEB_1_2028, endSec: MAR_1_2028 - 1 });
  });
});
