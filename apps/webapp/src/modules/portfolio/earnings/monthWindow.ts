import type { EarningsWindow } from './types';

/**
 * Calendar month-to-date window in UTC. The only place with calendar math —
 * the clock is always injected (no Date.now() in compute code) so tests and
 * query keys stay deterministic.
 */
export function monthToDateWindow(nowMs: number): EarningsWindow {
  const now = new Date(nowMs);
  return {
    startSec: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000,
    endSec: Math.floor(nowMs / 1000)
  };
}
