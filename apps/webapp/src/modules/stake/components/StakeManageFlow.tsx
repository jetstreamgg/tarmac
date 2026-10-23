import type { ReactNode } from 'react';
import { useSession, useSettleOnEnd } from '@/modules/ui/context/TransactionContext';
import { StakeFlow } from '../lib/constants';
import { useStakeManageEngine, type StakeManageParams } from '../hooks/useStakeManageEngine';
import { useStakeConfirmContent, type StakeLaunchContent } from '../hooks/useStakeConfirmContent';
import { StakeTransactionModal } from './StakeTransactionModal';

/**
 * The manage confirm flow a takeover (or the liquidation recovery) launches with
 * its staged changes. Runs the manage seam with the session's callbacks.
 */
export function StakeManageFlow({
  content,
  screenContent,
  onSuccess,
  ...params
}: StakeManageParams & {
  /** The full summary body; the wallet screen shows it when there is no `screenContent`. */
  content?: StakeLaunchContent;
  /** The compact wallet/status summary. */
  screenContent?: ReactNode;
  onSuccess?: () => void;
}) {
  const { txCallbacks } = useSession();
  const seam = useStakeManageEngine(params, txCallbacks);
  const transactionContent = useStakeConfirmContent({
    calls: seam.calls,
    isBatch: seam.isBatch,
    legCount: seam.legCount,
    content
  });

  // An approve that mined before a later leg failed must not reappear on the next
  // launch: the allowance reads are 30s-stale, so refresh them once the run has cleared (APP-563 #3).
  useSettleOnEnd(seam.reset, seam.refetchAllowances);

  return (
    <StakeTransactionModal
      flow={StakeFlow.MANAGE}
      stakeData={seam.stakeData}
      title={seam.title}
      toast={seam.toast}
      usdValue={seam.usdValue}
      transactionContent={transactionContent}
      transactionScreenContent={screenContent}
      steps={seam.steps}
      onConfirm={seam.execute}
      onSuccess={onSuccess}
    />
  );
}
