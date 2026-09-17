import { useCallback, useEffect, useRef } from 'react';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig, TransactionEntry } from '@/modules/ui/context/transactionContract';

/**
 * The config fields a flow keeps live after `launch()`. A field is pushed
 * exactly when named: `{ errorMessage: undefined }` pushes the clear, an
 * omitted `steps` leaves the launch-time steps alone.
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
  /** The engine `execute` (rebuilt every render); `onConfirm` wraps it through a ref. */
  execute?: () => void;
};

/**
 * The one place a flow pushes its live state into the open session. `launch()`
 * stores its config statically while the engine keeps re-rendering, so the
 * gating, steps, review body and screening value are pushed after the fact.
 * Three rules, once:
 *  - Freeze once the tx leaves IDLE: mid-flight refetches would collapse the
 *    executed steps/amounts on the status screens, or drift the `usdValue` a
 *    retry's screening tier is gated on (APP-517). Pushes resume on a failure
 *    that returns the status to IDLE.
 *  - A stable `onConfirm` over a live `execute`: a fresh closure per render
 *    would loop this effect on every provider re-render.
 *  - Bounded deps: callers pass MEMOIZED nodes/objects for the same reason.
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
