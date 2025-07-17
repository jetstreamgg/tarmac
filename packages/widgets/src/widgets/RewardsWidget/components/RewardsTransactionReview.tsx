import { RewardContract, Token, useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { BatchStatus } from '@widgets/shared/constants';
import {
  getRewardsSupplyReviewSubtitle,
  getRewardsWithdrawReviewSubtitle,
  rewardsActionDescription,
  RewardsFlow,
  rewardsSupplyReviewTitle,
  rewardsWithdrawReviewTitle
} from '@widgets/widgets/RewardsWidget/lib/constants';
import { useContext, useEffect } from 'react';

export const RewardsTransactionReview = ({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  rewardToken,
  rewardAmount,
  needsAllowance,
  selectedRewardContract,
  legalBatchTxUrl
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  rewardToken: Token;
  rewardAmount: bigint;
  needsAllowance: boolean;
  selectedRewardContract: RewardContract;
  legalBatchTxUrl?: string;
}) => {
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTxDescription,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(rewardToken);
    setOriginAmount(rewardAmount);
  }, [rewardToken, rewardAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === RewardsFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(rewardsSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getRewardsSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: rewardToken.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === RewardsFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(rewardsWithdrawReviewTitle));
      setTxSubtitle(i18n._(getRewardsWithdrawReviewSubtitle({ symbol: rewardToken.symbol })));
    }
    setTxDescription(
      i18n._(rewardsActionDescription({ flow, action, txStatus, needsAllowance, selectedRewardContract }))
    );
  }, [
    flow,
    action,
    screen,
    i18n.locale,
    isBatchTransaction,
    batchEnabled,
    batchSupported,
    selectedRewardContract
  ]);

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
    />
  );
};
