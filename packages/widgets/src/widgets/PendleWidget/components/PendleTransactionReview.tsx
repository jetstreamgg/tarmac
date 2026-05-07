import { useContext, useEffect } from 'react';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import {
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { BatchStatus } from '@widgets/shared/constants';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  PendleAction,
  PendleFlow,
  pendleBuyReviewTitle,
  pendleRedeemReviewTitle,
  pendleWithdrawReviewTitle,
  getPendleBuyReviewSubtitle,
  getPendleRedeemReviewSubtitle,
  getPendleWithdrawReviewSubtitle,
  getPendleActionDescription
} from '../lib/constants';

type PendleTransactionReviewProps = {
  market: PendleMarketConfig;
  originToken: Token;
  targetToken: Token;
  amount: bigint;
  quote?: PendleConvertQuote;
  isRedeemMode: boolean;
  /**
   * Override for the displayed target-amount tile. Used by the matured-redeem
   * flow where there is no API quote — the parent passes `amount` (1:1 PT →
   * underlying for SY-1:1 markets). When omitted, falls back to quote.amountOut.
   */
  targetAmount?: bigint;
  needsAllowance: boolean;
  /** True when the wallet will sign a single EIP-5792 batched call. */
  isBatchTransaction: boolean;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  legalBatchTxUrl?: string;
};

export const PendleTransactionReview = ({
  market,
  originToken,
  targetToken,
  amount,
  quote,
  isRedeemMode,
  targetAmount,
  needsAllowance,
  isBatchTransaction,
  batchEnabled,
  setBatchEnabled,
  legalBatchTxUrl
}: PendleTransactionReviewProps) => {
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setTxDescription,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  const resolvedTargetAmount = targetAmount ?? quote?.amountOut;

  // Push origin/target token + amount into context so TransactionDetail
  // (the default fallback rendered by TransactionReview) can show the
  // "input → output" tile.
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

  // Push title/subtitle/stepper copy.
  useEffect(() => {
    const batchStatus =
      !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED;

    if (flow === PendleFlow.BUY) {
      setTxTitle(i18n._(pendleBuyReviewTitle));
      setTxSubtitle(
        i18n._(
          getPendleBuyReviewSubtitle({
            batchStatus,
            symbol: market.underlyingSymbol,
            needsAllowance
          })
        )
      );
      setStepTwoTitle(t`Supply`);
    } else if (isRedeemMode) {
      setTxTitle(i18n._(pendleRedeemReviewTitle));
      setTxSubtitle(
        i18n._(getPendleRedeemReviewSubtitle(`PT-${market.underlyingSymbol}`, market.underlyingSymbol))
      );
      setStepTwoTitle(t`Redeem`);
    } else {
      setTxTitle(i18n._(pendleWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getPendleWithdrawReviewSubtitle({
            batchStatus,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            underlyingSymbol: market.underlyingSymbol,
            needsAllowance
          })
        )
      );
      setStepTwoTitle(t`Withdraw`);
    }
    setTxDescription(
      i18n._(
        getPendleActionDescription({
          flow: (flow as PendleFlow) ?? PendleFlow.BUY,
          action: (action as PendleAction | null) ?? null,
          txStatus,
          isRedeem: isRedeemMode,
          needsAllowance,
          underlyingSymbol: market.underlyingSymbol
        })
      )
    );
  }, [
    flow,
    action,
    screen,
    isRedeemMode,
    needsAllowance,
    isBatchTransaction,
    batchSupported,
    batchEnabled,
    txStatus,
    i18n.locale,
    market.underlyingSymbol,
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setTxDescription
  ]);

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
    />
  );
};
