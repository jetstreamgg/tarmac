import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useContext, useEffect, useState } from 'react';
import { Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { PsmConversionAction, PsmConversionScreen } from '../lib/constants';

export function PsmConversionStatus({
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance,
  currentCallIndex
}: {
  originToken: Token;
  originAmount: bigint;
  targetToken: Token;
  targetAmount: bigint;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
  currentCallIndex: number;
}) {
  const [flowNeedsAllowance] = useState(needsAllowance);
  const chainId = useChainId();
  const { i18n } = useLingui();
  const {
    setLoadingText,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setStep,
    setStepTwoTitle,
    step,
    txStatus,
    widgetState
  } = useContext(WidgetContext);

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
  }, [originAmount, originToken, setOriginAmount, setOriginToken, setTargetAmount, setTargetToken, targetAmount, targetToken]);

  useEffect(() => {
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      widgetState.action !== PsmConversionAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;
    const formattedOriginAmount = formatBigInt(originAmount, {
      unit: getTokenDecimals(originToken, chainId)
    });
    const formattedTargetAmount = formatBigInt(targetAmount, {
      unit: getTokenDecimals(targetToken, chainId)
    });

    if (widgetState.screen !== PsmConversionScreen.TRANSACTION) {
      return;
    }

    setStepTwoTitle(t`Convert`);
    setTxTitle(
      i18n._(
        flowTxStatus === TxStatus.SUCCESS
          ? t`Conversion complete`
          : flowTxStatus === TxStatus.ERROR
            ? t`Conversion failed`
            : widgetState.action === PsmConversionAction.APPROVE
              ? t`Approve conversion`
              : t`Processing conversion`
      )
    );
    setTxSubtitle(
      i18n._(
        flowTxStatus === TxStatus.SUCCESS
          ? t`Converted ${formattedOriginAmount} ${originToken.symbol} into ${formattedTargetAmount} ${targetToken.symbol}.`
          : widgetState.action === PsmConversionAction.APPROVE
            ? t`Approve ${originToken.symbol} so the conversion can proceed.`
            : t`Converting ${formattedOriginAmount} ${originToken.symbol} into ${formattedTargetAmount} ${targetToken.symbol}.`
      )
    );
    setTxDescription(
      i18n._(
        widgetState.action === PsmConversionAction.APPROVE
          ? t`This approval lets the Peg Stability Module spend your ${originToken.symbol}.`
          : t`The Peg Stability Module converts at a fixed 1:1 rate with no slippage.`
      )
    );
    setLoadingText(
      i18n._(
        widgetState.action === PsmConversionAction.APPROVE
          ? t`Approving ${originToken.symbol}`
          : t`Converting ${originToken.symbol} to ${targetToken.symbol}`
      )
    );

    if (isBatchTransaction || flowTxStatus === TxStatus.SUCCESS) {
      setStep(2);
    } else if (flowNeedsAllowance) {
      const candidateStep = currentCallIndex + 1;
      if (candidateStep <= step || txStatus !== TxStatus.LOADING) {
        setStep(candidateStep);
      }
    } else {
      setStep(2);
    }
  }, [
    chainId,
    currentCallIndex,
    flowNeedsAllowance,
    i18n,
    isBatchTransaction,
    originAmount,
    originToken,
    setLoadingText,
    setStep,
    setStepTwoTitle,
    setTxDescription,
    setTxSubtitle,
    setTxTitle,
    step,
    targetAmount,
    targetToken,
    txStatus,
    widgetState.action,
    widgetState.screen
  ]);

  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
}
