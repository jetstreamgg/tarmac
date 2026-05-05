import { useContext, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import type { PendleConvertQuote, PendleMarketConfig, Token } from '@jetstreamgg/sky-hooks';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import type { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { TxStatus } from '@widgets/shared/constants';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  PendleAction,
  PendleFlow,
  PendleScreen,
  pendleBuyTitle,
  pendleWithdrawTitle,
  getPendleSupplySubtitle,
  getPendleWithdrawSubtitle,
  getPendleSupplyLoadingButtonText,
  getPendleWithdrawLoadingButtonText,
  getPendleActionDescription
} from '../lib/constants';

type PendleTransactionStatusProps = {
  market: PendleMarketConfig;
  originToken: Token;
  targetToken: Token;
  amount: bigint;
  quote?: PendleConvertQuote;
  isRedeemMode: boolean;
  /**
   * Override for the displayed target-amount tile. Used by the matured-redeem
   * flow where there is no API quote — parent passes `amount` (1:1 PT →
   * underlying for SY-1:1 markets). When omitted, falls back to quote.amountOut.
   */
  targetAmount?: bigint;
  /** Whether the flow needs an approval at all (for subtitle wording). Snapshotted on mount. */
  needsAllowance: boolean;
  /** True when the wallet is signing a single EIP-5792 batched call. */
  isBatchTransaction?: boolean;
  /** Index of the currently executing call in the sequential (non-batched) flow. */
  currentCallIndex: number;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const PendleTransactionStatus = ({
  market,
  originToken,
  targetToken,
  amount,
  quote,
  isRedeemMode,
  targetAmount,
  needsAllowance,
  isBatchTransaction,
  currentCallIndex,
  onExternalLinkClicked
}: PendleTransactionStatusProps) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const [flowNeedsAllowance] = useState(needsAllowance);

  const {
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setLoadingText,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setStep,
    step,
    setStepTwoTitle,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  const resolvedTargetAmount = targetAmount ?? quote?.amountOut;

  // Origin/target token + amount feeds the TransactionDetail tile in the card.
  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(amount);
    setTargetToken(targetToken);
    setTargetAmount(resolvedTargetAmount);
  }, [
    originToken,
    targetToken,
    amount,
    resolvedTargetAmount,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount
  ]);

  // Title/subtitle/description/loading-text for each phase.
  useEffect(() => {
    if (screen !== PendleScreen.TRANSACTION) return;

    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== PendleAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    const amountStr = formatBigInt(amount, { unit: market.underlyingDecimals });

    if (flow === PendleFlow.BUY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(pendleBuyTitle[flowTxStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleSupplySubtitle({
            txStatus: flowTxStatus,
            amount: amountStr,
            symbol: market.underlyingSymbol,
            needsAllowance: flowNeedsAllowance
          })
        )
      );
      setLoadingText(
        i18n._(
          getPendleSupplyLoadingButtonText({
            txStatus: flowTxStatus,
            amount: amountStr,
            symbol: market.underlyingSymbol
          })
        )
      );
    } else {
      setStepTwoTitle(isRedeemMode ? t`Redeem` : t`Withdraw`);
      setTxTitle(i18n._(pendleWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleWithdrawSubtitle({
            txStatus: flowTxStatus,
            amount: amountStr,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            underlyingSymbol: market.underlyingSymbol,
            needsAllowance: flowNeedsAllowance,
            isRedeem: isRedeemMode
          })
        )
      );
      setLoadingText(
        i18n._(
          getPendleWithdrawLoadingButtonText({
            txStatus: flowTxStatus,
            amount: amountStr,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            isRedeem: isRedeemMode
          })
        )
      );
    }

    setTxDescription(
      i18n._(
        getPendleActionDescription({
          flow: flow as PendleFlow,
          action: (action as PendleAction | null) ?? null,
          txStatus: flowTxStatus,
          isRedeem: isRedeemMode,
          needsAllowance: flowNeedsAllowance,
          underlyingSymbol: market.underlyingSymbol
        })
      )
    );

    if (isBatchTransaction || flowTxStatus === TxStatus.SUCCESS) {
      setStep(2);
    } else if (flowNeedsAllowance) {
      const candidateStep = currentCallIndex + 1;
      // Don't advance step while txStatus is stale from the previous transaction.
      // When currentCallIndex advances (previous tx mined), txStatus is still LOADING.
      // Wait until txStatus transitions away from LOADING (e.g. to INITIALIZED via onMutate)
      // before advancing step, to prevent the next step from briefly flashing as loading.
      if (candidateStep <= step || txStatus !== TxStatus.LOADING) {
        setStep(candidateStep);
      }
    } else {
      setStep(2);
    }
  }, [
    txStatus,
    flow,
    action,
    screen,
    isRedeemMode,
    flowNeedsAllowance,
    isBatchTransaction,
    currentCallIndex,
    amount,
    market.underlyingSymbol,
    market.underlyingDecimals,
    chainId,
    i18n.locale,
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
