import { useCallback, useSyncExternalStore } from 'react';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { usePendingScope } from './usePendingScope';

const NONE: UnfinishedCctpSwap[] = [];

/** The connected account's CCTP swaps whose burn was never sent, newest first. */
export function useUnfinishedCctpSwaps(): UnfinishedCctpSwap[] {
  const { scope } = usePendingScope();
  const getSnapshot = useCallback(() => (scope ? cctpSwapStore.getSnapshot(scope) : NONE), [scope]);
  return useSyncExternalStore(cctpSwapStore.subscribe, getSnapshot);
}
