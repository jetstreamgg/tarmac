import { useEffect, useRef } from 'react';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

/**
 * Drops a page-hosted engine's run when the modal closes before it finished:
 * on a failure, or abandoned mid-run.
 *
 * Modal-hosted engines remount per launch, so a close always leaves a clean
 * slate. A page-hosted engine (convert, stake, the Pendle redeem card) survives
 * the close with its frozen call snapshot, and the next confirm would resume it
 * — signing the pre-edit amount while the page shows the edited one (APP-448).
 * Not only a close on a failure: a close while a later step waits in the
 * wallet abandons the session, and the wallet's rejection then pauses the run
 * with no ERROR ever shown.
 *
 * Only for engines whose calls before the last are allowance-gated approves,
 * which a reset never re-runs — provided the allowance read is fresh. It is
 * not, by itself: the read is a 30s-stale wagmi query that only a remount or
 * an explicit refetch refreshes, and a page-hosted engine never remounts. So
 * an approve that mined before the failed leg stayed invisible, and the next
 * launch rebuilt the Approve step (and the engine its approve call) from the
 * pre-approval value (APP-563 #3). `refetchReads` runs alongside the reset
 * for that: the engine's allowance refetchers.
 */
export function useResetPausedRunOnClose(reset: () => void, refetchReads?: () => void): void {
  const { isModalOpen, txStatus } = useTransaction();
  // Close hides the modal and returns the status to IDLE in one render, so an
  // unfinished run has to be remembered from before. It starts once a write
  // goes out or fails: a close while the first prompt is still open must not
  // reset, or an approve signed after the close mines behind a reset engine
  // and a refetched allowance, and the next launch asks for it again. A fresh
  // confirm (INITIALIZED from IDLE) starts over. The provider closes in the
  // same batch as it sets SUCCESS, so a success resets here too, harmlessly:
  // the engine has already finished. Minimize keeps the modal open, so a
  // running one is never reset here.
  const unfinishedRef = useRef(false);
  const prevStatusRef = useRef(txStatus);
  useEffect(() => {
    if (txStatus === TxStatus.LOADING || txStatus === TxStatus.ERROR) unfinishedRef.current = true;
    else if (txStatus === TxStatus.INITIALIZED && prevStatusRef.current === TxStatus.IDLE) {
      unfinishedRef.current = false;
    }
    prevStatusRef.current = txStatus;
    if (isModalOpen || !unfinishedRef.current) return;
    unfinishedRef.current = false;
    reset();
    refetchReads?.();
  }, [isModalOpen, txStatus, reset, refetchReads]);
}
