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
 * The Sky `getReward` farms are branded "ecosystem rewards" (SPK / GROVE / CLE),
 * and their modal says so (Figma 1036:190321); every other source claims under
 * the generic title.
 */
function modalTitle(scope: ClaimScope): string {
  return scope.kind === 'sky-rewards' || scope.kind === 'reward-contract'
    ? t`Claim ecosystem rewards`
    : t`Claim rewards`;
}

/**
 * Reusable trigger for the generalized "Claim rewards" modal. Any surface — the vault
 * position card, the portfolio reward tables, the rewards/stake pages — calls `openClaim`
 * with a `ClaimScope` instead of re-declaring the launch config. The scope both narrows
 * what the panel shows and IS the selection: `{kind:'merkl-token',tokenAddress}` claims
 * one token, `{kind:'merkl'}` every Merkl token, `{kind:'vault',vaultAddress}` only that
 * vault's Merkl rewards, etc. The body lives in `ClaimRewardsPanel`, mounted as
 * `backgroundContent` so its in-flight flow survives a minimize.
 */
export function useClaimRewardsModal({ onSuccess }: UseClaimRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const sessionId = useId();

  const openClaim = useCallback(
    (scope: ClaimScope) => {
      launch({
        title: modalTitle(scope),
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
