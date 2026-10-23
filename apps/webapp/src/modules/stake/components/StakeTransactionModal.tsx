import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import type { TransactionFlowProps } from '@/modules/ui/context/transactionContract';
import { TxStatus } from '@/modules/ui/lib/txStatus';
// The legacy msgid generators double as e2e anchors — reused, not forked (UI Spec §3).
import { getStakeTitle, type StakeFlow } from '../lib/constants';

/**
 * The confirm modal the open and manage takeovers launch. It is `skipReview`: the
 * takeover already served as the review (Design QA 2800:91832), so the modal opens
 * on the wallet screen and the gate runs at once; `title` is the minimized-toast
 * fallback only.
 */
export function StakeTransactionModal({
  flow,
  stakeData,
  ...props
}: Omit<TransactionFlowProps, 'analytics' | 'skipReview' | 'transactionTitle' | 'confirmLabel'> & {
  flow: StakeFlow;
  /** The legacy stakeData analytics payload (useStakeTransactionCallbacks shape). */
  stakeData: Record<string, unknown>;
}) {
  return (
    <TransactionModal
      {...props}
      skipReview
      transactionTitle={i18n._(getStakeTitle(TxStatus.INITIALIZED, flow))}
      confirmLabel={t`Confirm`}
      analytics={{ widgetName: 'stake', flow, action: 'multicall', data: stakeData }}
    />
  );
}
