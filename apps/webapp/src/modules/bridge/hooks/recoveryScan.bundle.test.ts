import { describe, expect, it } from 'vitest';
import { bundleScanDue, bundleScannedAt, markBundleScanned } from './recoveryScan';

// A wallet bundle without a hash has its chain read soon after the send and
// ever less often, never less than once per 30 minutes.

const MINUTE = 60_000;
const SENT = 1_700_000_000_000;

/** The minutes after the send at which a tick every `step` minutes reads the chain. */
const reads = (until: number, step = 2, readable: (minute: number) => boolean = () => true) => {
  const at: number[] = [];
  let last: number | undefined;
  for (let minute = 0; minute <= until; minute += step) {
    if (!bundleScanDue(SENT, last, SENT + minute * MINUTE)) continue;
    at.push(minute);
    if (readable(minute)) last = SENT + minute * MINUTE;
  }
  return at;
};

describe('the chain reads of a wallet bundle without a hash', () => {
  it('reads 2, 6, 14 and 30 minutes after the send, then every 30 minutes', () => {
    expect(reads(120)).toEqual([2, 6, 14, 30, 60, 90, 120]);
  });

  it('never leaves the bundle unread for more than 30 minutes', () => {
    const at = reads(600);
    const gaps = at.slice(1).map((minute, i) => minute - at[i]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(30);
  });

  it('reads at the first tick after a mark when the ticks fall between them', () => {
    expect(reads(40, 5)).toEqual([5, 10, 15, 30]);
  });

  it('tries again at every tick while the chain cannot be read', () => {
    expect(reads(12, 2, minute => minute >= 10)).toEqual([2, 4, 6, 8, 10]);
  });

  it('reads at once a bundle sent long ago that this session never read', () => {
    expect(bundleScanDue(SENT, undefined, SENT + 5 * 60 * MINUTE)).toBe(true);
    expect(bundleScanDue(SENT, undefined, SENT + MINUTE)).toBe(false);
  });

  it('keeps the last read of each bundle and scope apart', () => {
    markBundleScanned('scope-a', ['bundle-1', 'bundle-2'], 5);
    expect(bundleScannedAt('scope-a', 'bundle-1')).toBe(5);
    expect(bundleScannedAt('scope-a', 'bundle-2')).toBe(5);
    expect(bundleScannedAt('scope-b', 'bundle-1')).toBeUndefined();
    expect(bundleScannedAt('scope-a', 'bundle-3')).toBeUndefined();
  });
});
