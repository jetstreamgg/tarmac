import { useEffect, useRef } from 'react';
import { TxStatus } from '@/widgets';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

/**
 * Drops a page-hosted engine's paused run when the modal closes on an
 * UNRESOLVED one.
 *
 * Modal-hosted engines remount per launch, so a close always leaves a clean
 * slate. A page-hosted engine (convert, stake, the Pendle redeem card) survives
 * the close with its frozen call snapshot, and the next confirm would resume it
 * — signing the pre-edit amount while the page shows the edited one (APP-448).
 *
 * Unresolved means the session was last seen at INITIALIZED or ERROR:
 *  - ERROR is the failure close APP-448 covered.
 *  - INITIALIZED is the ABANDON close, and it leaks the same way. Closing while
 *    a later leg sits in the wallet leaves the run paused mid-sequence (the
 *    engine only drops its snapshot when the FIRST call is rejected), so
 *    reopening and editing the amount would resume the frozen leg and sign the
 *    old value. The wallet-transaction case is the dangerous one — the earlier
 *    legs really did mine — and nothing else clears it.
 *
 * LOADING and SUCCESS clear the latch: a broadcast leg is either still going
 * (dismissing it minimizes rather than closes) or completes the run, and a
 * completed run resets itself.
 *
 * Only for engines whose calls before the last are allowance-gated approves,
 * which a reset never re-runs.
 */
export function useResetPausedRunOnClose(reset: () => void): void {
  const { isModalOpen, txStatus } = useTransaction();
  // Close hides the modal and returns the status to IDLE in one render, so the
  // unresolved run has to be remembered from before.
  const unresolvedRef = useRef(false);
  useEffect(() => {
    if (txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.ERROR) unresolvedRef.current = true;
    else if (txStatus !== TxStatus.IDLE) unresolvedRef.current = false;
    if (isModalOpen || !unresolvedRef.current) return;
    unresolvedRef.current = false;
    reset();
  }, [isModalOpen, txStatus, reset]);
}
