import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useCctpBundleRecovery } from '../hooks/useCctpBundleRecovery';
import { useSentConvertResolution } from '../hooks/useSentConvertResolution';
import { useDepositRecovery } from '../hooks/useDepositRecovery';
import { useWithdrawalRecovery } from '../hooks/useWithdrawalRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  useBridgeTracker();
  useDepositRecovery();
  useWithdrawalRecovery();
  useCctpBundleRecovery();
  useSentConvertResolution();
  return null;
}
