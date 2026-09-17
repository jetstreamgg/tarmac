import { useCallback, useId } from 'react';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { ClaimRewardsPanel } from '../components/ClaimRewardsPanel';
import type { ClaimScope } from '../types';

type UseClaimRewardsModalOptions = {
  /** Fires after a successful claim — refetch the position/rewards. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the generalized "Claim rewards" modal. Any surface — the
 * vault position card, the portfolio reward tables, the rewards/stake pages —
 * calls `openClaim` with a `ClaimScope`. The scope both narrows what the panel
 * shows and IS the selection: `{kind:'merkl-token',tokenAddress}` claims one
 * token, `{kind:'merkl'}` every Merkl token, `{kind:'vault',vaultAddress}` only
 * that vault's Merkl rewards, etc. Reward claims are mainnet-only (APP-528).
 */
export function useClaimRewardsModal({ onSuccess }: UseClaimRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const sessionId = useId();

  const openClaim = useCallback(
    (scope: ClaimScope) => {
      launch({
        sessionId,
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        render: () => <ClaimRewardsPanel scope={scope} onSuccess={onSuccess} />
      });
    },
    [launch, sessionId, onSuccess]
  );

  return { openClaim };
}
