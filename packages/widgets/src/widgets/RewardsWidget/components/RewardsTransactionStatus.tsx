import { useContext, useEffect, useState } from 'react';
import {
  RewardsFlow,
  RewardsAction,
  RewardsScreen,
  rewardsSupplyTitle,
  rewardsWithdrawTitle,
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
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { TxStatus } from '@widgets/shared/constants';
import { getTokenDecimals, RewardContract, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

// TX Status wrapper to update copy
export const RewardsTransactionStatus = ({
  rewardToken,
  rewardAmount,
  selectedRewardContract,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance
}: {
  rewardAmount: bigint;
  rewardToken: Token;
  selectedRewardContract?: RewardContract;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
}) => {
  const [flowNeedsAllowance] = useState(needsAllowance);

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
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== RewardsAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    if (
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
    } else if (flow === RewardsFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);

      if (screen === RewardsScreen.TRANSACTION) {
        setLoadingText(
          i18n._(
            rewardsSupplyLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(rewardAmount, {
                unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
              }),
              symbol: rewardToken.symbol,
              action
            })
          )
        );
        setTxTitle(i18n._(rewardsSupplyTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            rewardsSupplySubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(rewardAmount, {
                unit: rewardToken ? getTokenDecimals(rewardToken, chainId) : 18
              }),
              symbol: rewardToken.symbol,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        if (selectedRewardContract) {
          setTxDescription(
            i18n._(
              rewardsActionDescription({
                flow,
                action,
                txStatus: flowTxStatus,
                selectedRewardContract,
                needsAllowance: flowNeedsAllowance
              })
            )
          );
        }

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    } else if (flow === RewardsFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);

      if (screen === RewardsScreen.TRANSACTION) {
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
          setTxDescription(
            i18n._(
              rewardsActionDescription({
                flow,
                action,
                txStatus,
                selectedRewardContract,
                needsAllowance: false // Withdraw flows don't need allowance
              })
            )
          );
        }

        setStep(2);
      }
    }
  }, [txStatus, flow, action, screen, i18n.locale, needsAllowance]);
  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
};
