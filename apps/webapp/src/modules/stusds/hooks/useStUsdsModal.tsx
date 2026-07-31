import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { StUsdsModalForm, type StUsdsModalPreset } from '../components/StUsdsModalForm';

type UseStUsdsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable stUSDS supply/withdraw modal — the stUSDS
 * analogue of `useSavingsModal` (stUSDS is a singleton product, so there are no
 * call-time args). Any surface (the position card, Portfolio quick-deposit, …)
 * calls this instead of re-declaring the launch config. Each opener mints its
 * own session so sibling modals never cross-talk.
 *
 * Analytics-free by design — attribution for these surfaces is a separate
 * sign-off-gated slice, following the savings-modal precedent.
 */
export function useStUsdsModal({ onSuccess }: UseStUsdsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (preset?: StUsdsModalPreset) => {
      launch({
        title: t`Supply to stUSDS`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to stUSDS.`,
          error: t`An error occurred while supplying to stUSDS.`
        },
        sessionId: supplySessionId,
        // Three-screen flow (vault-family recipe): the entry advances to the
        // review; the review's Confirm fires the engine. The body pushes the
        // review breakdown (`transactionContent`) live.
        reviewTitle: t`Review supply`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        confirmLabel: t`Confirm`,
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: <StUsdsModalForm sessionId={supplySessionId} flow="supply" preset={preset} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (preset?: StUsdsModalPreset) => {
      launch({
        title: t`Withdraw from stUSDS`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from stUSDS.`,
          error: t`An error occurred while withdrawing from stUSDS.`
        },
        sessionId: withdrawSessionId,
        reviewTitle: t`Review withdrawal`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        confirmLabel: t`Confirm`,
        backgroundContent: <StUsdsModalForm sessionId={withdrawSessionId} flow="withdraw" preset={preset} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
