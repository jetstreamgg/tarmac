import { useId, type ReactNode } from 'react';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { StakeOpenFlow } from '../components/StakeOpenFlow';
import { useStakeOpenEngine, type StakeOpenParams } from './useStakeOpenEngine';
import type { StakeLaunchContent } from './useStakeConfirmContent';

export { buildStakeOpenSteps } from './useStakeOpenEngine';

export interface UseStakeLaunchParams extends StakeOpenParams {
  /**
   * Full summary body (the stake/borrow amount heroes over the confirm grid). The
   * takeover is the review (Design QA 2800:91832), so the modal shows this only as
   * the wallet-screen fallback when no `transactionScreenContent` is passed. Pass a
   * function to receive the engine's own routing — the grid prices the live
   * network fee from it.
   */
  transactionContent?: StakeLaunchContent;
  /** Compact wallet/status-screen summary; omitted, the full body carries over. */
  transactionScreenContent?: ReactNode;
  /** Refetch positions/history + close the takeover after success. */
  onSuccess?: () => void;
}

/**
 * The open takeover's side of the confirm flow: the seam for its own gating and
 * preflight, and the launch, which hands the staged position to `StakeOpenFlow`.
 */
export function useStakeLaunch({
  transactionContent,
  transactionScreenContent,
  onSuccess,
  ...params
}: UseStakeLaunchParams) {
  const { launch: launchModal, isSettling } = useTransaction();
  const sessionId = useId();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const seam = useStakeOpenEngine(params);

  const launch = () =>
    launchModal({
      sessionId,
      // Staking is mainnet-only — guard the modal off any L2 (APP-528).
      supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
      flow: (
        <StakeOpenFlow
          {...params}
          content={transactionContent}
          screenContent={transactionScreenContent}
          onSuccess={onSuccess}
        />
      )
    });

  // The last launch's write is still out: the surface fires nothing until it lands (useSettleOnEnd).
  return { launch, locked, restore, ...seam, isLoading: seam.isLoading || isSettling(sessionId) };
}
