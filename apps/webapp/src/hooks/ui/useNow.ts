import { useEffect, useState } from 'react';

/**
 * The current epoch time in milliseconds, as state that ticks every
 * `intervalMs`.
 *
 * Calling `Date.now()` during render is impure (`react-hooks/purity`): two
 * renders of the same props produce different output and a memo can't tell
 * its result went stale. Holding "now" in state makes the passage of time
 * something React can see, so a countdown or a staleness check re-renders on
 * a schedule instead of whenever the component happens to render.
 *
 * Choose the interval by the coarsest unit the UI actually displays: 60s for
 * a days/hours/minutes countdown, finer only when a seconds figure is on
 * screen or a time-based guard has to flip close to on time.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
