import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Merkl } from '@/modules/icons';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { ClaimRewardsModalForm } from '../components/ClaimRewardsModalForm';

type UseClaimRewardsModalOptions = {
  /** Fires after a successful claim — refetch the position/rewards. */
  onSuccess?: () => void;
};

/** Merkl brand chip (icon + label) shown next to the modal title. */
function MerklBadge() {
  return (
    <span className="bg-surface text-text inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium">
      <Merkl className="h-3 w-3" />
      <Trans>Merkl</Trans>
    </span>
  );
}

/**
 * Reusable trigger for the Merkl "Claim rewards" modal. Any surface (the vault
 * position card, Portfolio, …) calls this instead of re-declaring the launch
 * config. The modal shows ALL of the user's claimable Merkl rewards (all-claimable
 * scope) with per-token checkboxes defaulting to all; the editable selection body
 * lives in `ClaimRewardsModalForm`, mirroring the Savings modal pattern.
 */
export function useClaimRewardsModal({ onSuccess }: UseClaimRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const sessionId = useId();

  const openClaim = useCallback(() => {
    launch({
      title: t`Claim rewards`,
      transactionTitle: t`Confirm in the wallet`,
      titleBadge: <MerklBadge />,
      subtitles: {
        loading: t`Your claim is being processed on the blockchain. Please wait.`,
        success: t`You've successfully claimed your rewards.`,
        error: t`An error occurred while claiming your rewards.`
      },
      sessionId,
      entry: { confirmLabel: t`Claim`, confirmDisabled: true },
      // The editable selection body lives outside the dialog (hidden host) so its
      // in-flight hook survives minimize; it portals into the modal's entry slot.
      backgroundContent: <ClaimRewardsModalForm sessionId={sessionId} />,
      onConfirm: () => {},
      onSuccess
    });
  }, [launch, sessionId, onSuccess]);

  return { openClaim };
}
