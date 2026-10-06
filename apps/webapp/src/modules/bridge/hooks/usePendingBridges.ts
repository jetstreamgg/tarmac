import { useMemo } from 'react';
import { useNow } from '@/hooks/ui/useNow';
import { isPendingBridgeVisible } from '../model/pendingTransitions';
import { useBridgeHistory } from './useBridgeHistory';

const TICK_MS = 15_000;

/**
 * Bridges shown under the form: active ones, and settled ones for a day.
 * `now` ticks for the remaining-time estimate.
 */
export function usePendingBridges() {
  const all = useBridgeHistory();
  const now = useNow(TICK_MS);
  // A bridge stored after the last tick is newer than `now`; it is visible either way.
  const bridges = useMemo(() => all.filter(bridge => isPendingBridgeVisible(bridge, now)), [all, now]);
  return { bridges, now };
}
