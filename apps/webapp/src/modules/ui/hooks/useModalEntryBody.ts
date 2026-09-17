import { useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEntrySlot } from '@/modules/ui/context/TransactionContext';
import type { TransactionAnalytics, TransactionConfig } from '@/modules/ui/context/transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { useLaunchSync } from './useLaunchSync';

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
  /**
   * User-readable engine/prepare failure shown above the confirm button on both
   * first screens. Always pushed — `undefined` clears it, so a stale message
   * never outlives the engine recovering. Explanatory only: pair it with
   * `confirmDisabled` to actually block the confirm.
   */
  errorMessage?: string;
  /** Read-only breakdown for a three-screen flow's review stage. */
  transactionContent?: ReactNode;
  /** Compact amount summary rendered on the wallet/status screen. */
  transactionScreenContent?: ReactNode;
  /** Steps for multi-step flows (labels or `{ label, tokenSymbol }` chips). */
  steps?: TransactionStep[];
  /** Per-state minimized-toast titles. */
  toast?: TransactionConfig['toast'];
  /**
   * Live USD notional of the transaction, for the enhanced-screening
   * threshold (APP-517; see `TransactionConfig.usdValue`). REQUIRED, like
   * the launch-time field, and always pushed: an editable body owns the live
   * amount, so it must state its valuation every render — `undefined` means
   * "unknown" and is treated as above-threshold (fail closed). Were this
   * optional, a future form could compile while silently screening a $300k
   * transaction on the standard tier through its stale launch value.
   */
  usdValue: number | undefined;
  /**
   * Analytics attribution for the lifecycle events the provider emits. Pass a
   * MEMOIZED object (the sync effect below depends on its identity). The last
   * IDLE push is what the confirm-click's `onMutate` reads, so it always
   * reflects the amount/token that produced the calldata. Two-CTA flows whose
   * `action` depends on which button was clicked push at confirm instead
   * (the stake-claim pattern) — don't pass this from those.
   */
  analytics?: TransactionAnalytics;
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
 * (SavingsModalForm / VaultModalForm / the claim adapters): the `useLaunchSync`
 * push that keeps the shared modal's confirm gating + handler + wallet summary
 * in sync (entry descriptor included), and the entry-slot portal that displays
 * the body inside the dialog while its hook host stays mounted (and
 * minimize-surviving) outside it.
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
  errorMessage,
  transactionContent,
  transactionScreenContent,
  steps,
  toast,
  usdValue,
  analytics
}: UseModalEntryBodyParams): (body: ReactNode) => ReactNode {
  const entrySlot = useEntrySlot();

  // `confirmDisabled` and `errorMessage` gate/annotate the entry screen via the
  // entry descriptor and the review stage via the top-level field — same value,
  // both screens. `confirmLabel` merges only when supplied (bodies that don't
  // pass it keep their launch-time label); `confirmAction` and `errorMessage`
  // are always pushed so clearing them (undefined) reliably restores the normal
  // confirm / drops a stale error. Memoized: it is a dep of the sync effect.
  const entry = useMemo(
    () => ({
      confirmDisabled,
      ...(confirmLabel !== undefined ? { confirmLabel } : {}),
      confirmAction,
      errorMessage
    }),
    [confirmDisabled, confirmLabel, confirmAction, errorMessage]
  );

  // The optional fields merge only when supplied, so a body that doesn't use
  // steps/toast never clobbers them with `undefined`. `usdValue` is always
  // pushed: `undefined` means "unknown" and must reach the config (it flips the
  // enhanced-screening path on).
  useLaunchSync({
    sessionId,
    execute,
    entry,
    confirmDisabled,
    errorMessage,
    ...(transactionContent !== undefined ? { transactionContent } : {}),
    ...(transactionScreenContent !== undefined ? { transactionScreenContent } : {}),
    ...(steps !== undefined ? { steps } : {}),
    ...(toast !== undefined ? { toast } : {}),
    usdValue,
    ...(analytics !== undefined ? { analytics } : {})
  });

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and its engine hook — mounted).
  return useCallback((body: ReactNode) => (entrySlot ? createPortal(body, entrySlot) : body), [entrySlot]);
}
