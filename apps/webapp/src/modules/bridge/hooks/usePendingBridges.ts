import { useSyncExternalStore } from 'react';
import { mockPendingStore } from '../mocks/mockPendingStore';

/** Bridges still worth showing on the page: anything not yet claimed. */
export function usePendingBridges() {
  const all = useSyncExternalStore(mockPendingStore.subscribe, mockPendingStore.getSnapshot);
  return all.filter(bridge => bridge.status !== 'claimed');
}
