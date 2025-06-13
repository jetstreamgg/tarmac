import { useContext, useEffect } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionStatus } from '@widgets/shared/components/ui/transaction/TransactionStatus';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import {
  UpgradeFlow,
  UpgradeAction,
  UpgradeScreen,
  approveUpgradeSubtitle,
  upgradeSubtitle,
  revertSubtitle,
  approveRevertSubtitle,
  upgradeApproveTitle,
  upgradeTitle,
  revertTitle,
  upgradeActionDescription,
  upgradeRevertLoadingButtonText
} from '../lib/constants';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { approveLoadingButtonText } from '@widgets/shared/constants';
import { useChainId } from 'wagmi';

export const UpgradeTransactionStatus = ({
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  onExternalLinkClicked
}: {
  originAmount: bigint;
  originToken: Token;
  targetAmount: bigint;
  targetToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
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
    if (flow === UpgradeFlow.UPGRADE) setStepTwoTitle(t`Upgrade`);
    if (flow === UpgradeFlow.REVERT) setStepTwoTitle(t`Revert`);
    // Upgrade & Approve transaction state
    if (
      flow === UpgradeFlow.UPGRADE &&
      action === UpgradeAction.APPROVE &&
      screen === UpgradeScreen.TRANSACTION
    ) {
      setStep(1);
      setLoadingText(i18n._(approveLoadingButtonText[txStatus as keyof TxCardCopyText]));
      setTxTitle(i18n._(upgradeApproveTitle(txStatus, flow)));
      setTxSubtitle(i18n._(approveUpgradeSubtitle(txStatus, originToken.symbol)));
      setTxDescription(
        i18n._(upgradeActionDescription({ flow, action, txStatus, originToken, targetToken }))
      );
      // Revert & Approve transaction state
    } else if (
      flow === UpgradeFlow.REVERT &&
      action === UpgradeAction.APPROVE &&
      screen === UpgradeScreen.TRANSACTION
    ) {
      setStep(1);
      setTxTitle(i18n._(upgradeApproveTitle(txStatus, flow)));
      setTxSubtitle(i18n._(approveRevertSubtitle(txStatus, originToken.symbol)));
      setTxDescription(
        i18n._(upgradeActionDescription({ flow, action, txStatus, originToken, targetToken }))
      );
    } else if (
      // Upgrade & Upgrade transaction state
      flow === UpgradeFlow.UPGRADE &&
      action === UpgradeAction.UPGRADE &&
      screen === UpgradeScreen.TRANSACTION
    ) {
      setStep(2);
      setLoadingText(
        i18n._(
          upgradeRevertLoadingButtonText({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol,
            actionLabel: 'Upgrading'
          })
        )
      );
      setTxTitle(i18n._(upgradeTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          upgradeSubtitle({
            txStatus,
            amount: formatBigInt(targetAmount, { unit: getTokenDecimals(targetToken, chainId) }),
            symbol: targetToken.symbol
          })
        )
      );
      setTxDescription(
        i18n._(upgradeActionDescription({ flow, action, txStatus, originToken, targetToken }))
      );
      // Revert & Revert transaction state
    } else if (
      flow === UpgradeFlow.REVERT &&
      action === UpgradeAction.REVERT &&
      screen === UpgradeScreen.TRANSACTION
    ) {
      setStep(2);
      setLoadingText(
        i18n._(
          upgradeRevertLoadingButtonText({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol,
            actionLabel: 'Reverting'
          })
        )
      );
      setTxTitle(i18n._(revertTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          revertSubtitle({
            txStatus,
            amount: formatBigInt(targetAmount, { unit: getTokenDecimals(targetToken, chainId) }),
            symbol: targetToken.symbol
          })
        )
      );
      setTxDescription(
        i18n._(upgradeActionDescription({ flow, action, txStatus, originToken, targetToken }))
      );
    }
  }, [txStatus, screen, flow, action, i18n.locale]);

  return <TransactionStatus onExternalLinkClicked={onExternalLinkClicked} />;
};
