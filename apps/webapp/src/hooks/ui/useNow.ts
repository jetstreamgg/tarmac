import { useEffect, useState } from 'react';

/**
 * The current epoch time in milliseconds, as state that ticks every
 * `intervalMs` (default one minute).
 *
 * Calling `Date.now()` during render is impure (`react-hooks/purity`): two
 * renders of the same props produce different output and a memo can't tell
 * its result went stale. Holding "now" in state makes the passage of time
 * something React can see, so a countdown or a staleness check re-renders on
 * a schedule instead of whenever the component happens to render.
 *
 * The default suits a days/hours/minutes countdown. Pass a finer interval
 * only when a seconds figure is on screen or a time-based guard has to flip
 * close to on time.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
