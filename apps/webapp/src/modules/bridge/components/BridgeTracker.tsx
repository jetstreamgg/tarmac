import { useBridgeTracker } from '../hooks/useBridgeTracker';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  return null;
}
