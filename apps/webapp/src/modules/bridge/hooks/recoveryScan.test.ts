/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markCompleteScan } from '../store/recoveryScanStamp';
import { RECOVERY_INTERVAL_MS, retryDelay, scannedRecently, settledFor } from './recoveryScan';

describe('recovery scan pace', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('backs off from 2 minutes, doubling up to the 30 minute interval', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual(
      [2, 4, 8, 16, 30, 30].map(minutes => minutes * 60_000)
    );
  });

  it('keeps the settled bridges of each kind and scope apart, across calls', () => {
    settledFor('deposit', 'scope-a').add('0xa');
    expect(settledFor('deposit', 'scope-a').has('0xa')).toBe(true);
    expect(settledFor('withdrawal', 'scope-a').has('0xa')).toBe(false);
    expect(settledFor('deposit', 'scope-b').has('0xa')).toBe(false);
  });

  it("skips only a load's first scan, and only after a complete one in the last interval", () => {
    vi.useFakeTimers({ now: 1_000_000_000 });
    expect(scannedRecently('withdrawal', 'scope', true)).toBe(false);
    markCompleteScan('withdrawal', 'scope', Date.now() - RECOVERY_INTERVAL_MS + 1);
    expect(scannedRecently('withdrawal', 'scope', true)).toBe(true);
    expect(scannedRecently('withdrawal', 'scope', false)).toBe(false);
    expect(scannedRecently('deposit', 'scope', true)).toBe(false);
    vi.setSystemTime(Date.now() + 1);
    expect(scannedRecently('withdrawal', 'scope', true)).toBe(false);
  });
});
