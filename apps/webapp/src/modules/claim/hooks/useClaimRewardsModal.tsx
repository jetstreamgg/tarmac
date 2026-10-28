import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { ClaimRewardsFlow } from '../components/ClaimRewardsFlow';
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
 * with a `ClaimScope`. The scope both narrows what the flow shows and IS the selection: `{kind:'merkl-token',tokenAddress}` claims
 * one token, `{kind:'merkl'}` every Merkl token, `{kind:'vault',vaultAddress}` only that
 * vault's Merkl rewards, etc.
 */
export function useClaimRewardsModal({ onSuccess }: UseClaimRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const sessionId = useId();

  const openClaim = useCallback(
    (scope: ClaimScope) =>
      launch({
        sessionId,
        // Reward claims are mainnet-only — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <ClaimRewardsFlow scope={scope} title={modalTitle(scope)} onSuccess={onSuccess} />
      }),
    [launch, sessionId, onSuccess]
  );

  return { openClaim };
}
