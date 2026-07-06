const SECONDS_PER_DAY = 86_400;

/** Conservative window length when the API hasn't provided a market start. */
const FALLBACK_WINDOW_SECONDS = 180 * SECONDS_PER_DAY;

export type MaturityWindow = {
  /** Elapsed share of the maturity window, clamped to [0, 100]. */
  pct: number;
  /** Seconds until expiry, floored at 0. */
  remainingSeconds: number;
};

/**
 * Elapsed-vs-total maturity window math shared by the maturity progress
 * surfaces. Source-of-truth precedence matches TimeToMaturityCard: the real
 * window when the API gives a start timestamp, else a 180-day window measured
 * backward from expiry.
 */
export function computeMaturityWindow({
  expirySec,
  startSec,
  nowSec
}: {
  expirySec: number;
  startSec?: number;
  nowSec: number;
}): MaturityWindow {
  const remainingSeconds = Math.max(0, expirySec - nowSec);
  const totalSeconds =
    startSec !== undefined && expirySec > startSec ? expirySec - startSec : FALLBACK_WINDOW_SECONDS;
  const elapsedSeconds = Math.min(totalSeconds, Math.max(0, nowSec - (expirySec - totalSeconds)));
  const pct = totalSeconds === 0 ? 0 : (elapsedSeconds / totalSeconds) * 100;
  return { pct: Math.min(100, Math.max(0, pct)), remainingSeconds };
}
