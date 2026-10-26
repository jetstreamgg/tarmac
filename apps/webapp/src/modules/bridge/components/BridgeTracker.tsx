import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useBundledConvertResolution } from '../hooks/useBundledConvertResolution';
import { useDepositRecovery } from '../hooks/useDepositRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  useDepositRecovery();
  useBundledConvertResolution();
  return null;
}
