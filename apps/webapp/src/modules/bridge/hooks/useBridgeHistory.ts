import { useSyncExternalStore } from 'react';
import { mockPendingStore } from '../mocks/mockPendingStore';

/** Every bridge this session started, claimed ones included (Activity feed). */
export function useBridgeHistory() {
  return useSyncExternalStore(mockPendingStore.subscribe, mockPendingStore.getSnapshot);
}
