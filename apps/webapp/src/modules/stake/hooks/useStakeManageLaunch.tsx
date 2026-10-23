import { useId, type ReactNode } from 'react';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { StakeManageFlow } from '../components/StakeManageFlow';
import { useStakeManageEngine, type StakeManageParams } from './useStakeManageEngine';
import type { StakeLaunchContent } from './useStakeConfirmContent';

export { buildStakeManageSteps } from './useStakeManageEngine';

export interface UseStakeManageLaunchParams extends StakeManageParams {
  /**
   * Full summary body (the amount heroes over the confirm grid). The sheet is the
   * review (Design QA 2800:91832), so the modal shows this only as the
   * wallet-screen fallback when no `transactionScreenContent` is passed. Pass a
   * function to receive the engine's own routing — the grid prices the live
   * network fee from it.
   */
  transactionContent?: StakeLaunchContent;
  /** Compact wallet/status-screen summary; omitted, the full body carries over. */
  transactionScreenContent?: ReactNode;
  onSuccess?: () => void;
}

/**
 * A manage surface's side of the confirm flow: the seam for its own gating and
 * preflight, and the launch, which hands the staged changes to `StakeManageFlow`.
 */
export function useStakeManageLaunch({
  transactionContent,
  transactionScreenContent,
  onSuccess,
  ...params
}: UseStakeManageLaunchParams) {
  const { launch: launchModal, isSettling } = useTransaction();
  const sessionId = useId();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const seam = useStakeManageEngine(params);

  const launch = () =>
    launchModal({
      sessionId,
      // Staking is mainnet-only — guard the modal off any L2 (APP-528).
      supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
      flow: (
        <StakeManageFlow
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
