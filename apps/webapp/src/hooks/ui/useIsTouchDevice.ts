import { useSyncExternalStore } from 'react';

// Touch capability doesn't change after page load, so subscribe is a no-op.
// Hoisted outside the hook so its identity is stable across renders.
const subscribeTouch = () => () => {};
const getTouchSnapshot = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const getTouchServerSnapshot = () => false;

/**
 * Hook to detect if the current device supports touch interactions.
 * Returns false initially for SSR compatibility, then updates after mount.
 *
 * @returns {boolean} true if the device supports touch, false otherwise
 */
export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribeTouch, getTouchSnapshot, getTouchServerSnapshot);
}
