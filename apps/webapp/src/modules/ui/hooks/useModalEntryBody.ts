import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TxStatus } from '@/widgets';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

/**
 * The live fields an editable modal body keeps in sync after launch. `confirmDisabled`
 * is always pushed; the rest are merged only when supplied, so a body that doesn't use
 * steps/toast (e.g. a single-step claim) never clobbers them with `undefined`.
 */
type ModalEntryBodyLive = {
  /** Disables the shared modal's confirm button (amount zero / over balance / nothing selected). */
  confirmDisabled: boolean;
  /**
   * Live entry-CTA label. A body that passes it must pass it EVERY render (the
   * entry merge keeps the last pushed value) — e.g. the upgrade form swaps
   * "Connect wallet" ↔ "Continue" with the connection state. Omit entirely to
   * keep the launch-time label.
   */
  confirmLabel?: string;
  /**
   * Entry-CTA override fired instead of starting the transaction (see
   * `TransactionEntry.confirmAction`). Always pushed — `undefined` restores
   * the normal confirm, so an override never outlives its condition.
   */
  confirmAction?: () => void;
  /** Read-only breakdown for a three-screen flow's review stage. */
  transactionContent?: ReactNode;
  /** Compact amount summary rendered on the wallet/status screen. */
  transactionScreenContent?: ReactNode;
  /** Steps for multi-step flows (labels or `{ label, tokenSymbol }` chips). */
  steps?: TransactionStep[];
  /** Per-state minimized-toast titles. */
  toast?: TransactionConfig['toast'];
};

type UseModalEntryBodyParams = ModalEntryBodyLive & {
  /** Session this body live-updates — gates `updateModalContent` to the active launch. */
  sessionId: string;
  /**
   * The engine `execute`, rebuilt every render (its calls array is fresh each time).
   * Read from a ref so `onConfirm` stays stable and never needs re-pushing — pushing
   * a fresh `onConfirm` each render would loop the sync effect below.
   */
  execute: () => void;
};

/**
 * The shared boilerplate every editable transaction-modal body repeats
 * (SavingsModalForm / VaultModalForm / the claim adapters): a stable `onConfirm`
 * over a live `execute` ref, the `updateModalContent` push that keeps the shared
 * modal's confirm gating + handler + wallet summary in sync, and the entry-slot
 * portal that displays the body inside the dialog while its hook host stays mounted
 * (and minimize-surviving) outside it.
 *
 * Returns `renderInSlot(body)`: portals `body` into the dialog's entry slot when one
 * is mounted, else renders it inline in the hidden background host.
 */
export function useModalEntryBody({
  sessionId,
  execute,
  confirmDisabled,
  confirmLabel,
  confirmAction,
  transactionContent,
  transactionScreenContent,
  steps,
  toast
}: UseModalEntryBodyParams): (body: ReactNode) => ReactNode {
  const { updateModalContent, txStatus } = useTransaction();
  const entrySlot = useEntrySlot();

  // `execute` is rebuilt every render; read the latest from a ref so `onConfirm`
  // is stable and never needs re-pushing.
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Keep the shared modal's confirm gating + handler + wallet summary (+ optional
  // step labels / toast titles) live. Merged into the entry (never replacing
  // `content`), so the body stays mounted; bounded to its listed deps, so it can't
  // loop on provider re-renders. Frozen once the tx leaves IDLE: mid-flight
  // refetches (allowance after an approve, balances after success) rebuild the
  // body's steps/summaries, and pushing that state would collapse the executed
  // step list and amounts on the wallet/status/failure screens (the convert and
  // stake-claim precedent). Pushes resume when the status resets to IDLE (back
  // from a failure returns to an editable entry).
  useEffect(() => {
    if (txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      // `confirmDisabled` gates the entry screen via the entry descriptor and the
      // review stage via the top-level field — same value, both screens.
      // `confirmLabel` merges only when supplied (bodies that don't pass it keep
      // their launch-time label); `confirmAction` is always pushed so clearing
      // it (undefined) reliably restores the normal confirm.
      entry: {
        confirmDisabled,
        ...(confirmLabel !== undefined ? { confirmLabel } : {}),
        confirmAction
      },
      confirmDisabled,
      onConfirm,
      ...(transactionContent !== undefined ? { transactionContent } : {}),
      ...(transactionScreenContent !== undefined ? { transactionScreenContent } : {}),
      ...(steps !== undefined ? { steps } : {}),
      ...(toast !== undefined ? { toast } : {})
    });
  }, [
    sessionId,
    txStatus,
    confirmDisabled,
    confirmLabel,
    confirmAction,
    transactionContent,
    transactionScreenContent,
    steps,
    toast,
    onConfirm,
    updateModalContent
  ]);

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and its engine hook — mounted).
  return useCallback((body: ReactNode) => (entrySlot ? createPortal(body, entrySlot) : body), [entrySlot]);
}
