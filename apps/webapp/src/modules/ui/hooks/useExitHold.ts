import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a conditionally-rendered subtree mounted for the length of its exit
 * animation after its flag clears, so an AnimatePresence inside it has
 * something to animate. Without it the flag and the subtree clear in the same
 * tick and the exit is silently killed (the unmounting-parent trap).
 */
export function useExitHold(active: boolean, ms: number) {
  const [held, setHeld] = useState(active);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Opening is immediate; only the release is deferred.
  if (active && !held) setHeld(true);

  useEffect(() => {
    if (active || !held) return;
    timer.current = setTimeout(() => setHeld(false), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, held, ms]);

  return held;
}
