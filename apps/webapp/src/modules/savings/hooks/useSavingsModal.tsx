import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { chainIdsForIntent } from '@/lib/chainAvailability';
import { Intent } from '@/lib/enums';
import { SavingsModalForm, type SavingsModalPreset } from '../components/SavingsModalForm';

// Savings is a multi-chain product (mainnet + every supported L2). Switching
// among these chains is legitimate and the form re-resolves; the guard only
// fires if the wallet reaches a chain that offers no Savings at all (APP-528).
const SAVINGS_SUPPORTED_CHAIN_IDS = chainIdsForIntent(Intent.SAVINGS_INTENT);

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
        reviewTitle: t`Review supply`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to Sky Savings.`,
          error: t`An error occurred while supplying to Sky Savings.`
        },
        sessionId: supplySessionId,
        // Three-screen flow (Figma 859:36036 → 859:36154 → 859:36214): the entry
        // advances to the review; the review's Confirm fires the engine. The body
        // pushes the review breakdown (`transactionContent`) live.
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        // Nothing entered yet; the form keeps this live (enhanced screening, APP-517).
        usdValue: 0,
        supportedChainIds: SAVINGS_SUPPORTED_CHAIN_IDS,
        confirmLabel: t`Confirm`,
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: <SavingsModalForm sessionId={supplySessionId} flow="supply" preset={preset} />,
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
        reviewTitle: t`Review withdrawal`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from Sky Savings.`,
          error: t`An error occurred while withdrawing from Sky Savings.`
        },
        sessionId: withdrawSessionId,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        // Nothing entered yet; the form keeps this live (enhanced screening, APP-517).
        usdValue: 0,
        supportedChainIds: SAVINGS_SUPPORTED_CHAIN_IDS,
        confirmLabel: t`Confirm`,
        backgroundContent: <SavingsModalForm sessionId={withdrawSessionId} flow="withdraw" preset={preset} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
