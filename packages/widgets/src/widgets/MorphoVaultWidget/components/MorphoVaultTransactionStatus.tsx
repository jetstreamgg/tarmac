import { useContext, useEffect, useState } from 'react';
import {
  MorphoVaultFlow,
  MorphoVaultAction,
  MorphoVaultScreen,
  supplySubtitle,
  withdrawSubtitle,
  morphoVaultActionDescription,
  supplyLoadingButtonText,
  withdrawLoadingButtonText,
  morphoVaultSupplyTitle,
  morphoVaultWithdrawTitle
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';

export const MorphoVaultTransactionStatus = ({
  assetToken,
  amount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance
}: {
  amount: bigint;
  assetToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
}) => {
  // Capture needsAllowance at mount to avoid state changes during transaction
  const [flowNeedsAllowance] = useState(needsAllowance);

  const { i18n } = useLingui();
  const chainId = useChainId();
  const {
    setLoadingText,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setOriginToken,
    setOriginAmount,
    setStep,
    setStepTwoTitle,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(assetToken);
    setOriginAmount(amount);
  }, [assetToken, amount, setOriginToken, setOriginAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== MorphoVaultAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    const formattedAmount = formatBigInt(amount, { unit: getTokenDecimals(assetToken, chainId) });

    if (flow === MorphoVaultFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);

      if (screen === MorphoVaultScreen.TRANSACTION) {
        setTxTitle(i18n._(morphoVaultSupplyTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            supplySubtitle({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(
          i18n._(
            morphoVaultActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            supplyLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol,
              action
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (flowNeedsAllowance) setStep(1);
          else setStep(2);
        }
      }
    } else if (flow === MorphoVaultFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);

      if (screen === MorphoVaultScreen.TRANSACTION) {
        setTxTitle(i18n._(morphoVaultWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            withdrawSubtitle({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol
            })
          )
        );
        setTxDescription(
          i18n._(
            morphoVaultActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            withdrawLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol
            })
          )
        );

        setStep(2);
      }
    }
  }, [
    txStatus,
    flow,
    action,
    screen,
    i18n.locale,
    flowNeedsAllowance,
    isBatchTransaction,
    amount,
    assetToken,
    chainId,
    i18n,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setLoadingText,
    setStep,
    setStepTwoTitle
  ]);

  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
};
