import { useContext, useEffect, useState } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import {
  UpgradeFlow,
  UpgradeAction,
  UpgradeScreen,
  upgradeSubtitle,
  revertSubtitle,
  upgradeTitle,
  revertTitle,
  upgradeActionDescription,
  upgradeRevertLoadingButtonText
} from '../lib/constants';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TxStatus } from '@widgets/shared/constants';
import { useChainId } from 'wagmi';

export const UpgradeTransactionStatus = ({
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance
}: {
  originAmount: bigint;
  originToken: Token;
  targetAmount: bigint;
  targetToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
}) => {
  const [flowNeedsAllowance] = useState(needsAllowance);

  const chainId = useChainId();
  const {
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    txStatus,
    widgetState,
    setStep,
    setStepTwoTitle,
    setLoadingText
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
  }, [originToken, originAmount, targetToken, targetAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== UpgradeAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    if (flow === UpgradeFlow.UPGRADE) {
      setStepTwoTitle(t`Upgrade`);

      if (screen === UpgradeScreen.TRANSACTION) {
        setLoadingText(
          i18n._(
            upgradeRevertLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              actionLabel: action === UpgradeAction.APPROVE ? 'Approving' : 'Upgrading'
            })
          )
        );
        setTxTitle(i18n._(upgradeTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            upgradeSubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(targetAmount, { unit: getTokenDecimals(targetToken, chainId) }),
              originToken,
              targetToken,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(
          i18n._(
            upgradeActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              originToken,
              targetToken,
              needsAllowance: flowNeedsAllowance
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    } else if (flow === UpgradeFlow.REVERT) {
      setStepTwoTitle(t`Revert`);

      if (screen === UpgradeScreen.TRANSACTION) {
        setLoadingText(
          i18n._(
            upgradeRevertLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              actionLabel: action === UpgradeAction.APPROVE ? 'Approving' : 'Reverting'
            })
          )
        );
        setTxTitle(i18n._(revertTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            revertSubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(targetAmount, { unit: getTokenDecimals(targetToken, chainId) }),
              originToken,
              targetToken,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(
          i18n._(
            upgradeActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              originToken,
              targetToken,
              needsAllowance: flowNeedsAllowance
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    }
  }, [txStatus, screen, flow, action, i18n.locale, needsAllowance]);

  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
};
