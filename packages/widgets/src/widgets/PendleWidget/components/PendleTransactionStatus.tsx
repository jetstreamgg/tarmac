import { useContext, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { getTokenDecimals } from '@jetstreamgg/sky-hooks';
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

  // Origin/target token + amount feeds the TransactionDetail tile in the card.
  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(amount);
    setTargetToken(targetToken);
    setTargetAmount(quote?.amountOut);
  }, [
    originToken,
    targetToken,
    amount,
    quote?.amountOut,
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

    // Decimals follow the input side: BUY input is the user-selected supply
    // token; SELL input is PT (which inherits market.underlyingDecimals via
    // the SY). Symbol for the user-selected side comes from the matching
    // Token object, not from market.underlyingSymbol.
    const inputDecimals =
      flow === PendleFlow.BUY ? getTokenDecimals(originToken, chainId) : market.underlyingDecimals;
    const amountStr = formatBigInt(amount, { unit: inputDecimals });
    const userSideSymbol = flow === PendleFlow.BUY ? originToken.symbol : targetToken.symbol;

    if (flow === PendleFlow.BUY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(pendleBuyTitle[flowTxStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleSupplySubtitle({
            txStatus: flowTxStatus,
            amount: amountStr,
            symbol: userSideSymbol,
            needsAllowance: flowNeedsAllowance
          })
        )
      );
      setLoadingText(
        i18n._(
          getPendleSupplyLoadingButtonText({
            txStatus: flowTxStatus,
            amount: amountStr,
            symbol: userSideSymbol
          })
        )
      );
    } else {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(pendleWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleWithdrawSubtitle({
            txStatus: flowTxStatus,
            amount: amountStr,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            underlyingSymbol: userSideSymbol,
            needsAllowance: flowNeedsAllowance
          })
        )
      );
      setLoadingText(
        i18n._(
          getPendleWithdrawLoadingButtonText({
            txStatus: flowTxStatus,
            amount: amountStr,
            ptSymbol: `PT-${market.underlyingSymbol}`
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
          needsAllowance: flowNeedsAllowance,
          underlyingSymbol: userSideSymbol
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
    flowNeedsAllowance,
    isBatchTransaction,
    currentCallIndex,
    amount,
    market.underlyingSymbol,
    market.underlyingDecimals,
    originToken,
    targetToken,
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
