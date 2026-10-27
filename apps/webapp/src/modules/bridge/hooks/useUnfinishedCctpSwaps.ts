import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { cctpSwapStore, isSwapSpendable, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingScope } from './usePendingScope';

const NONE: UnfinishedCctpSwap[] = [];

/**
 * The connected account's CCTP swaps that can be continued, newest first: no
 * burn was sent for them, or the last one failed. A swap whose burn may still
 * land is left out, so its USDC is never burned twice, as is one whose USDC a
 * convert was sent for.
 */
export function useUnfinishedCctpSwaps(): UnfinishedCctpSwap[] {
  const { scope } = usePendingScope();
  const getSnapshot = useCallback(() => (scope ? cctpSwapStore.getSnapshot(scope) : NONE), [scope]);
  const swaps = useSyncExternalStore(cctpSwapStore.subscribe, getSnapshot);
  const bridges = useBridgeHistory();
  return useMemo(() => swaps.filter(swap => isSwapSpendable(swap, bridges)), [swaps, bridges]);
}
