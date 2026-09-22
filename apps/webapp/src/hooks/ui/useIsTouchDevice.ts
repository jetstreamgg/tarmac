import { useSyncExternalStore } from 'react';

// Touch capability is fixed for the life of the page, so there is nothing to
// subscribe to; the store exists so the read goes through React rather than
// through state set after mount.
const subscribe = () => () => {};
const getSnapshot = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const getServerSnapshot = () => false;

/**
 * Whether the current device supports touch interactions.
 */
export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
