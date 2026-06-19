import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { SavingsModalForm, type SavingsModalPreset } from '../components/SavingsModalForm';

type UseSavingsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable Savings supply/withdraw modal. Any surface
 * (the position card, Portfolio quick-deposit, …) calls this instead of
 * re-declaring the launch config. Each opener mints its own session so sibling
 * modals never cross-talk; pass a `preset` to seed the amount/token, or omit it
 * to open empty.
 */
export function useSavingsModal({ onSuccess }: UseSavingsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  // Analytics-free by design — attribution for these surfaces is a separate
  // sign-off-gated slice (PRD Out of Scope), not part of the trigger.
  const openSupply = useCallback(
    (preset?: SavingsModalPreset) => {
      launch({
        title: t`Supply to Sky Savings`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to Sky Savings.`,
          error: t`An error occurred while supplying to Sky Savings.`
        },
        sessionId: supplySessionId,
        entry: { confirmLabel: t`Supply`, confirmDisabled: true },
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: (
          <SavingsModalForm sessionId={supplySessionId} flow="supply" preset={preset} />
        ),
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (preset?: SavingsModalPreset) => {
      launch({
        title: t`Withdraw from Sky Savings`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from Sky Savings.`,
          error: t`An error occurred while withdrawing from Sky Savings.`
        },
        sessionId: withdrawSessionId,
        entry: { confirmLabel: t`Withdraw`, confirmDisabled: true },
        backgroundContent: (
          <SavingsModalForm sessionId={withdrawSessionId} flow="withdraw" preset={preset} />
        ),
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
