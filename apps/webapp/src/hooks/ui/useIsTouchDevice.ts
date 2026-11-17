import { useSyncExternalStore } from 'react';

// The device's primary input can't hover: phones and tablets. Touch capability
// alone (`ontouchstart`, `maxTouchPoints`) is the wrong signal, since
// touchscreen laptops and tablets with a trackpad have it too and still hover.
const NO_HOVER_QUERY = '(hover: none)';

// The answer can change while the page is open, e.g. a trackpad attached to a
// tablet.
const subscribe = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(NO_HOVER_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
};
const getSnapshot = () => window.matchMedia(NO_HOVER_QUERY).matches;
const getServerSnapshot = () => false;

/**
 * Whether the device is touch-first: its primary input can't hover, so
 * hover-driven UI needs a tap fallback.
 */
export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
