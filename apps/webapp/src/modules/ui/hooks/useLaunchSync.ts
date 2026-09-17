import { useCallback, useEffect, useRef } from 'react';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig, TransactionEntry } from '@/modules/ui/context/transactionContract';

/**
 * The config fields a flow keeps live after `launch()`. A field is pushed
 * exactly when the caller names it — `{ errorMessage: undefined }` pushes the
 * clear, an omitted `steps` leaves the launch-time steps alone — so each flow
 * states what it owns and never clobbers the rest.
 */
export type LaunchSyncFields = Partial<
  Pick<
    TransactionConfig,
    | 'confirmDisabled'
    | 'confirmLabel'
    | 'errorMessage'
    | 'transactionContent'
    | 'transactionScreenContent'
    | 'steps'
    | 'toast'
    | 'usdValue'
    | 'analytics'
  >
> & {
  /** Merged into the launch-time entry, never replacing its `content`. */
  entry?: Partial<TransactionEntry>;
};

export type UseLaunchSyncParams = LaunchSyncFields & {
  /** Session this flow live-updates — the provider ignores every other session's pushes. */
  sessionId: string;
  /**
   * The engine `execute`, rebuilt every render (its calls array is fresh each
   * time). Read through a ref so the `onConfirm` pushed (and returned, for the
   * launch config) is stable and never needs re-pushing.
   */
  execute?: () => void;
};

/**
 * The one place a flow pushes its live state into the open session.
 *
 * Every flow that launches the shared modal has the same problem: `launch()`
 * stores its config statically, but the engine keeps re-rendering (allowance
 * reads, quotes, fee estimates, the user's amount), so the confirm gating, the
 * step list, the review body and the screening value all have to be pushed
 * after the fact through `updateModalContent`. This hook owns the three rules
 * every copy of that push had to restate:
 *
 *  - **Freeze once the tx leaves IDLE.** Mid-flight refetches (the allowance
 *    after an approve, balances after success, a repolled quote) rebuild the
 *    values, and pushing them would collapse the executed step list and
 *    amounts on the wallet/status/failure screens — or drift the `usdValue` a
 *    retry's screening tier is gated on (APP-517). Pushes resume when a
 *    failure returns the status to IDLE.
 *  - **A stable `onConfirm` over a live `execute`.** The stored `onConfirm`
 *    can't be live-updated, and pushing a fresh closure every render would
 *    re-run this effect on every provider re-render — a loop.
 *  - **Bounded deps.** The effect runs on the values, not on a fresh options
 *    object, so a provider re-render alone never triggers a push. Callers pass
 *    MEMOIZED nodes/objects (`transactionContent`, `analytics`, `toast`) for
 *    the same reason.
 *
 * Returns the stable `onConfirm`, for flows that pass it at launch.
 */
export function useLaunchSync(params: UseLaunchSyncParams): { onConfirm: () => void } {
  const { updateModalContent, txStatus } = useTransaction();
  const {
    sessionId,
    execute,
    entry,
    confirmDisabled,
    confirmLabel,
    errorMessage,
    transactionContent,
    transactionScreenContent,
    steps,
    toast,
    usdValue,
    analytics
  } = params;
  // Presence, not value: a named-but-undefined field is a deliberate clear.
  const has = (key: keyof LaunchSyncFields) => key in params;
  const hasEntry = has('entry');
  const hasConfirmDisabled = has('confirmDisabled');
  const hasConfirmLabel = has('confirmLabel');
  const hasErrorMessage = has('errorMessage');
  const hasTransactionContent = has('transactionContent');
  const hasTransactionScreenContent = has('transactionScreenContent');
  const hasSteps = has('steps');
  const hasToast = has('toast');
  const hasUsdValue = has('usdValue');
  const hasAnalytics = has('analytics');
  const hasExecute = execute !== undefined;

  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current?.(), []);

  useEffect(() => {
    if (txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      ...(hasEntry ? { entry } : {}),
      ...(hasConfirmDisabled ? { confirmDisabled } : {}),
      ...(hasConfirmLabel ? { confirmLabel } : {}),
      ...(hasErrorMessage ? { errorMessage } : {}),
      ...(hasTransactionContent ? { transactionContent } : {}),
      ...(hasTransactionScreenContent ? { transactionScreenContent } : {}),
      ...(hasSteps ? { steps } : {}),
      ...(hasToast ? { toast } : {}),
      ...(hasUsdValue ? { usdValue } : {}),
      ...(hasAnalytics ? { analytics } : {}),
      ...(hasExecute ? { onConfirm } : {})
    });
  }, [
    updateModalContent,
    sessionId,
    txStatus,
    hasEntry,
    entry,
    hasConfirmDisabled,
    confirmDisabled,
    hasConfirmLabel,
    confirmLabel,
    hasErrorMessage,
    errorMessage,
    hasTransactionContent,
    transactionContent,
    hasTransactionScreenContent,
    transactionScreenContent,
    hasSteps,
    steps,
    hasToast,
    toast,
    hasUsdValue,
    usdValue,
    hasAnalytics,
    analytics,
    hasExecute,
    onConfirm
  ]);

  return { onConfirm };
}
