import { useCallback, useSyncExternalStore } from 'react';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { usePendingScope } from './usePendingScope';

const NONE: PendingBridge[] = [];

/** Every stored bridge of the connected account, newest first (Activity feed). */
export function useBridgeHistory(): PendingBridge[] {
  const { scope } = usePendingScope();
  const getSnapshot = useCallback(() => (scope ? pendingBridgeStore.getSnapshot(scope) : NONE), [scope]);
  return useSyncExternalStore(pendingBridgeStore.subscribe, getSnapshot);
}
