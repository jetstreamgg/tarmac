import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { ClaimRewardsPanel } from '../components/ClaimRewardsPanel';
import type { ClaimScope } from '../types';

type UseClaimRewardsModalOptions = {
  /** Fires after a successful claim — refetch the position/rewards. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the generalized "Claim rewards" modal. Any surface — the vault
 * position card, the portfolio claim-all, the rewards/stake pages — calls `openClaim`
 * with a `ClaimScope` instead of re-declaring the launch config. The scope narrows what
 * the panel shows: `{kind:'vault',vaultAddress}` surfaces only that vault's Merkl
 * rewards, `{kind:'all'}` the cross-source list, etc. The editable selection body lives
 * in `ClaimRewardsPanel`, mounted as `backgroundContent` so its in-flight flow survives
 * a minimize.
 */
export function useClaimRewardsModal({ onSuccess }: UseClaimRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const sessionId = useId();

  const openClaim = useCallback(
    (scope: ClaimScope) => {
      launch({
        title: t`Claim rewards`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your claim is being processed on the blockchain. Please wait.`,
          success: t`You've successfully claimed your rewards.`,
          error: t`An error occurred while claiming your rewards.`
        },
        sessionId,
        entry: { confirmLabel: t`Claim`, confirmDisabled: true },
        backgroundContent: <ClaimRewardsPanel sessionId={sessionId} scope={scope} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, sessionId, onSuccess]
  );

  return { openClaim };
}
