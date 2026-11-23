import { useBridgeTracker } from '../hooks/useBridgeTracker';
import { useCctpBundleRecovery } from '../hooks/useCctpBundleRecovery';
import { useSentConvertResolution } from '../hooks/useSentConvertResolution';
import { useDepositRecovery } from '../hooks/useDepositRecovery';
import { useDismissedSourceWatch } from '../hooks/useDismissedSourceWatch';
import { useRecoveryWanted } from '../hooks/useRecoveryWanted';
import { useWithdrawalRecovery } from '../hooks/useWithdrawalRecovery';

/** Mounted once in the app shell while the bridge is enabled. */
export function BridgeTracker() {
  // Stored bridges are tracked on every route; the scans for unknown ones run only where wanted.
  const wanted = useRecoveryWanted();
  useBridgeTracker();
  useDepositRecovery(wanted);
  useWithdrawalRecovery(wanted);
  useCctpBundleRecovery();
  useSentConvertResolution();
  useDismissedSourceWatch();
  return null;
}
