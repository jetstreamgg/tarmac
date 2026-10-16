import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useDepositRecovery } from '../hooks/useDepositRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  useDepositRecovery();
  return null;
}
