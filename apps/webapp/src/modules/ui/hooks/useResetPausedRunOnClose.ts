import { useEffect, useRef } from 'react';
import { TxStatus } from '@/widgets';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

/**
 * Drops a page-hosted engine's paused run when the modal closes on a failure.
 *
 * Modal-hosted engines remount per launch, so a close always leaves a clean
 * slate. A page-hosted engine (convert, stake, the Pendle redeem card) survives
 * the close with its frozen call snapshot, and the next confirm would resume it
 * — signing the pre-edit amount while the page shows the edited one (APP-448).
 *
 * Only for engines whose calls before the last are allowance-gated approves,
 * which a reset never re-runs.
 */
export function useResetPausedRunOnClose(reset: () => void): void {
  const { isModalOpen, txStatus } = useTransaction();
  // Close hides the modal and returns the status to IDLE in one render, so the
  // failure has to be remembered from before.
  const failedRef = useRef(false);
  useEffect(() => {
    if (txStatus === TxStatus.ERROR) failedRef.current = true;
    else if (txStatus !== TxStatus.IDLE) failedRef.current = false;
    if (isModalOpen || !failedRef.current) return;
    failedRef.current = false;
    reset();
  }, [isModalOpen, txStatus, reset]);
}
