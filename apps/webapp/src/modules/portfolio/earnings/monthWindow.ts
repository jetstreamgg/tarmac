import type { EarningsWindow } from './types';

/**
 * The current calendar month as a window, in UTC. The only place with calendar
 * math — the clock is always injected (no Date.now() in compute code) so tests
 * and query keys stay deterministic.
 *
 * endSec is the month's last second, not "now": future events don't exist, so
 * the two bounds filter identically for month-to-date math, but this one can
 * never go stale — a memoized "now" bound would exclude fresh in-month flows
 * arriving via refetch and inflate the monthly figure by the deposit amount.
 */
export function monthToDateWindow(nowMs: number): EarningsWindow {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    startSec: Date.UTC(year, month, 1) / 1000,
    endSec: Date.UTC(year, month + 1, 1) / 1000 - 1
  };
}
