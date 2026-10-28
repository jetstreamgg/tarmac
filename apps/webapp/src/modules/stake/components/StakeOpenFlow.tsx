import type { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { useSession, useSettleOnEnd } from '@/modules/ui/context/TransactionContext';
import { StakeFlow } from '../lib/constants';
import { useStakeOpenEngine, type StakeOpenParams } from '../hooks/useStakeOpenEngine';
import { useStakeConfirmContent, type StakeLaunchContent } from '../hooks/useStakeConfirmContent';
import { StakeTransactionModal } from './StakeTransactionModal';

/** The open-position confirm flow the takeover launches with its staged position. */
export function StakeOpenFlow({
  content,
  screenContent,
  onSuccess,
  ...params
}: StakeOpenParams & {
  /** The full summary body; the wallet screen shows it when there is no `screenContent`. */
  content?: StakeLaunchContent;
  /** The compact wallet/status summary. */
  screenContent?: ReactNode;
  onSuccess?: () => void;
}) {
  const { txCallbacks } = useSession();
  const seam = useStakeOpenEngine(params, txCallbacks);
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
      flow={StakeFlow.OPEN}
      stakeData={seam.stakeData}
      title={t`Confirm`}
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
