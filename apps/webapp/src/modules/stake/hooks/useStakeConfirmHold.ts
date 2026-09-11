import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useTransactionPreflight } from '@/modules/ui/context/TransactionContext';

/**
 * The Confirm hold shared by the open-position takeover and the manage sheet.
 * Both surfaces ARE the review (Design QA 2800:91832), so the two holds the
 * modal's first screen would otherwise apply run here instead:
 *  - the enhanced-screening preflight for a $250k+ transaction (APP-517):
 *    Confirm waits on a pending verdict (loading) and is held, with the
 *    reason, on a blocked one;
 *  - the chain guard (APP-528): staking is mainnet-only, and a wallet that
 *    has moved off it gets the explanation here — the provider refuses a
 *    wrong-chain fire at the gate and, with no first screen to return to,
 *    would otherwise just close the modal.
 * An engine prepare failure takes the alert slot otherwise. The gate
 * re-checks both at fire time.
 */
export function useStakeConfirmHold({
  usdValue,
  actionable,
  launchErrorMessage
}: {
  usdValue: number | undefined;
  /** The flow's own gating would let the user proceed (valid, prepared, settled). */
  actionable: boolean;
  /** The engine's prepare failure, if any (see enginePrepareErrorMessage). */
  launchErrorMessage: string | null | undefined;
}): {
  disabled: boolean;
  loading: boolean;
  /** What replaces the footer's helper copy, if anything. */
  alert: { kind: 'chain' | 'preflight' | 'prepare'; message: React.ReactNode } | null;
} {
  const chainId = useChainId();
  const offChain = !MAINNET_FAMILY_CHAIN_IDS.includes(chainId);
  const preflight = useTransactionPreflight({ usdValue, actionable: actionable && !offChain });
  const blocked = preflight.kind === 'blocked';
  return {
    disabled: !actionable || offChain || blocked,
    loading: actionable && !offChain && preflight.kind === 'pending',
    alert: offChain
      ? { kind: 'chain', message: t`Staking is only available on Ethereum. Switch networks to continue.` }
      : blocked
        ? { kind: 'preflight', message: preflight.message }
        : launchErrorMessage
          ? { kind: 'prepare', message: launchErrorMessage }
          : null
  };
}
