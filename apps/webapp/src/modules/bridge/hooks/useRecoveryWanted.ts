import { useEffect, useSyncExternalStore } from 'react';
import { useBridgeHistory } from './useBridgeHistory';

// How many places showing the account's bridges are open: the Bridge tab, the wallet drawer.
let surfaces = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const open = (by: number) => {
  surfaces += by;
  listeners.forEach(listener => listener());
};
const anyOpen = () => surfaces > 0;

/** Marks a place that shows the account's bridges as open while it is mounted. */
export function useBridgeSurface() {
  useEffect(() => {
    open(1);
    return () => open(-1);
  }, []);
}

/**
 * Whether the chains are scanned for the account's bridges: while a place
 * showing them is open, or once the account has a bridge in this browser.
 */
export function useRecoveryWanted() {
  const shown = useSyncExternalStore(subscribe, anyOpen);
  return useBridgeHistory().length > 0 || shown;
}
