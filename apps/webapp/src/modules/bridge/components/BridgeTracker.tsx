import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useSentConvertResolution } from '../hooks/useSentConvertResolution';
import { useDepositRecovery } from '../hooks/useDepositRecovery';
import { useWithdrawalRecovery } from '../hooks/useWithdrawalRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  useDepositRecovery();
  useWithdrawalRecovery();
  useSentConvertResolution();
  return null;
}
