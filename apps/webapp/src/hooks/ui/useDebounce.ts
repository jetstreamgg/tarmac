import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delay` ms (500 by default).
 *
 * `resetKey` names what `value` is measured in. When it changes, the wait is
 * skipped: the new value is returned at once and debouncing resumes from it. A
 * value held over from before the change would be read in the new terms — an
 * amount typed in USDS read with USDC's decimals — and the change itself is one
 * discrete pick, not a burst of keystrokes worth waiting out.
 */
export function useDebounce<T>(value: T, delay?: number, resetKey?: unknown): T {
  const [settled, setSettled] = useState({ value, resetKey });
  const keyChanged = !Object.is(settled.resetKey, resetKey);

  useEffect(() => {
    // A changed key is adopted on the next tick rather than in this effect, so the
    // state update stays asynchronous; until then the live value is returned.
    const timer = setTimeout(
      () =>
        setSettled(prev =>
          Object.is(prev.value, value) && Object.is(prev.resetKey, resetKey) ? prev : { value, resetKey }
        ),
      keyChanged ? 0 : (delay ?? 500)
    );

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay, resetKey, keyChanged]);

  return keyChanged ? value : settled.value;
}
