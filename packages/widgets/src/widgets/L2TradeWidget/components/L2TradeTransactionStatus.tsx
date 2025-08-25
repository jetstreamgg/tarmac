import { useContext, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt, WAD_PRECISION } from '@jetstreamgg/sky-utils';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { TradeAction, TradeFlow, TradeScreen } from '../../TradeWidget/lib/constants';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import {
  l2TradeDescription,
  l2TradeLoadingButtonText,
  l2TradeSubtitle,
  l2TradeTitle
} from '../lib/constants';
import { TxStatus } from '@widgets/shared/constants';

// TX Status wrapper to update copy
export const L2TradeTransactionStatus = ({
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance
}: {
  originToken: Token;
  originAmount: bigint;
  targetToken: Token;
  targetAmount: bigint;
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
    setLoadingText,
    txStatus,
    widgetState,
    setStep,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount
  } = useContext(WidgetContext);

  const { flow, action, screen } = widgetState;

  const executionPrice =
    originAmount && targetAmount
      ? (
          +formatUnits(originAmount, getTokenDecimals(originToken, chainId) || WAD_PRECISION) /
          +formatUnits(targetAmount, getTokenDecimals(targetToken, chainId) || WAD_PRECISION)
        ).toString()
      : undefined;

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
      action !== TradeAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    if (flow === TradeFlow.TRADE) {
      setStepTwoTitle(t`Trade`);

      if (screen === TradeScreen.TRANSACTION) {
        setTxTitle(i18n._(l2TradeTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            l2TradeSubtitle({
              txStatus: flowTxStatus,
              originToken,
              originAmount: formatBigInt(originAmount, {
                unit: originToken ? getTokenDecimals(originToken, chainId) : 18
              }),
              targetToken,
              targetAmount: formatBigInt(targetAmount, {
                unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18
              }),
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(i18n._(l2TradeDescription({ originToken, targetToken, executionPrice })));
        setLoadingText(
          i18n._(
            l2TradeLoadingButtonText({
              txStatus: flowTxStatus,
              action,
              amount: formatBigInt(originAmount, {
                unit: originToken ? getTokenDecimals(originToken, chainId) : 18
              }),
              symbol: originToken.symbol
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
  }, [txStatus, flow, action, screen, i18n.locale, needsAllowance]);

  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
};
