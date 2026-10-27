import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useSentConvertResolution } from '../hooks/useSentConvertResolution';
import { useDepositRecovery } from '../hooks/useDepositRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  useDepositRecovery();
  useSentConvertResolution();
  return null;
}
