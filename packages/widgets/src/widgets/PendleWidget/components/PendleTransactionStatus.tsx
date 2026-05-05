import { useContext, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { type PendleConvertQuote, type PendleMarketConfig, type Token } from '@jetstreamgg/sky-hooks';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  PendleFlow,
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
  flow: PendleFlow;
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
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

const buildUnderlyingToken = (market: PendleMarketConfig): Token => ({
  name: market.underlyingSymbol,
  symbol: market.underlyingSymbol,
  decimals: market.underlyingDecimals,
  color: '#6d7ce3',
  address: { 1: market.underlyingToken }
});

const buildPtToken = (market: PendleMarketConfig): Token => ({
  name: `PT-${market.underlyingSymbol}`,
  symbol: `PT-${market.underlyingSymbol}`,
  decimals: market.underlyingDecimals,
  color: '#f97316',
  address: { 1: market.ptToken }
});

export const PendleTransactionStatus = ({
  market,
  flow,
  amount,
  quote,
  isRedeemMode,
  targetAmount,
  needsAllowance,
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
    setStepTwoTitle,
    txStatus
  } = useContext(WidgetContext);

  const underlyingToken = buildUnderlyingToken(market);
  const ptToken = buildPtToken(market);
  const originToken = flow === PendleFlow.BUY ? underlyingToken : ptToken;
  const targetToken = flow === PendleFlow.BUY ? ptToken : underlyingToken;

  const resolvedTargetAmount = targetAmount ?? quote?.amountOut;

  // Origin/target token + amount feeds the TransactionDetail tile in the card.
  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(amount);
    setTargetToken(targetToken);
    setTargetAmount(resolvedTargetAmount);
  }, [originToken, targetToken, amount, resolvedTargetAmount, setOriginToken, setOriginAmount, setTargetToken, setTargetAmount]);

  // Title/subtitle/description/loading-text for each phase.
  useEffect(() => {
    const amountStr = formatBigInt(amount, { unit: market.underlyingDecimals });

    if (flow === PendleFlow.BUY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(pendleBuyTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleSupplySubtitle({
            txStatus,
            amount: amountStr,
            symbol: market.underlyingSymbol,
            needsAllowance: flowNeedsAllowance
          })
        )
      );
      setLoadingText(
        i18n._(
          getPendleSupplyLoadingButtonText({
            txStatus,
            amount: amountStr,
            symbol: market.underlyingSymbol
          })
        )
      );
    } else {
      setStepTwoTitle(isRedeemMode ? t`Redeem` : t`Withdraw`);
      setTxTitle(i18n._(pendleWithdrawTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getPendleWithdrawSubtitle({
            txStatus,
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
            txStatus,
            amount: amountStr,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            isRedeem: isRedeemMode
          })
        )
      );
    }

    setTxDescription(i18n._(getPendleActionDescription(flow, isRedeemMode, market.underlyingSymbol)));

    // Pendle always uses EIP-5792 batched execution, so the step indicator is
    // always on its terminal step — same shape as Savings's batched branch.
    setStep(2);
  }, [
    txStatus,
    flow,
    isRedeemMode,
    flowNeedsAllowance,
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

  return <BatchTransactionStatus onExternalLinkClicked={onExternalLinkClicked} />;
};
