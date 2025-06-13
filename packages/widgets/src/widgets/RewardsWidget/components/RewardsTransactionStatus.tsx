import { useContext, useEffect } from 'react';
import {
  RewardsFlow,
  RewardsAction,
  RewardsScreen,
  rewardsApproveTitle,
  rewardsSupplyTitle,
  rewardsWithdrawTitle,
  rewardsApproveSubtitle,
  rewardsSupplySubtitle,
  rewardsWithdrawSubtitle,
  rewardsSupplyLoadingButtonText,
  rewardsWithdrawLoadingButtonText,
  rewardsActionDescription,
  rewardsClaimLoadingButtonText,
  rewardsClaimTitle,
  rewardsClaimSubtitle,
  rewardsClaimTxDescription
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionStatus } from '@widgets/shared/components/ui/transaction/TransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { approveLoadingButtonText } from '@widgets/shared/constants';
import { getTokenDecimals, RewardContract, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

// TX Status wrapper to update copy
export const RewardsTransactionStatus = ({
  rewardToken,
  rewardAmount,
  selectedRewardContract,
  onExternalLinkClicked
}: {
  rewardAmount: bigint;
  rewardToken: Token;
  selectedRewardContract?: RewardContract;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const {
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    txStatus,
    widgetState,
    setStep,
    setStepTwoTitle,
    setLoadingText,
    setOriginToken,
    setOriginAmount
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(rewardToken);
    setOriginAmount(rewardAmount);
  }, [rewardToken, rewardAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === RewardsFlow.SUPPLY) setStepTwoTitle(t`Supply`);
    if (flow === RewardsFlow.WITHDRAW) setStepTwoTitle(t`Withdraw`);
    // Supply & Approve transaction state
    if (
      flow === RewardsFlow.SUPPLY &&
      action === RewardsAction.APPROVE &&
      screen === RewardsScreen.TRANSACTION
    ) {
      setStep(1);
      setLoadingText(i18n._(approveLoadingButtonText[txStatus as keyof TxCardCopyText]));
      setTxTitle(i18n._(rewardsApproveTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(i18n._(rewardsApproveSubtitle(txStatus, rewardToken.symbol)));
      if (selectedRewardContract) {
        setTxDescription(i18n._(rewardsActionDescription({ flow, txStatus, selectedRewardContract })));
      }
      // Supply & Supply transaction state
    } else if (
      flow === RewardsFlow.SUPPLY &&
      action === RewardsAction.SUPPLY &&
      screen === RewardsScreen.TRANSACTION
    ) {
      setStep(2);
      setLoadingText(
        i18n._(
          rewardsSupplyLoadingButtonText({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      setTxTitle(i18n._(rewardsSupplyTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          rewardsSupplySubtitle({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      if (selectedRewardContract) {
        setTxDescription(i18n._(rewardsActionDescription({ flow, txStatus, selectedRewardContract })));
      }
    } else if (
      // Withdraw & Withdraw transaction state
      flow === RewardsFlow.WITHDRAW &&
      action === RewardsAction.WITHDRAW &&
      screen === RewardsScreen.TRANSACTION
    ) {
      setStep(2);
      setLoadingText(
        i18n._(
          rewardsWithdrawLoadingButtonText({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      setTxTitle(i18n._(rewardsWithdrawTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          rewardsWithdrawSubtitle({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      if (selectedRewardContract) {
        setTxDescription(i18n._(rewardsActionDescription({ flow, txStatus, selectedRewardContract })));
      }
    } else if (
      // Claim rewards
      action === RewardsAction.CLAIM &&
      screen === RewardsScreen.TRANSACTION
    ) {
      setLoadingText(
        i18n._(
          rewardsClaimLoadingButtonText({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      setTxTitle(i18n._(rewardsClaimTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          rewardsClaimSubtitle({
            txStatus,
            amount: formatBigInt(rewardAmount, {
              unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
            }),
            symbol: rewardToken.symbol
          })
        )
      );
      if (selectedRewardContract) {
        setTxDescription(i18n._(rewardsClaimTxDescription({ txStatus, selectedRewardContract })));
      }
    }
  }, [txStatus, flow, action, screen, i18n.locale]);
  return <TransactionStatus onExternalLinkClicked={onExternalLinkClicked} />;
};
