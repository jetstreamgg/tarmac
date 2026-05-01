import { useContext, useEffect, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { type PendleConvertQuote, type PendleMarketConfig, type Token } from '@jetstreamgg/sky-hooks';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
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
  flow: PendleFlow;
  amount: bigint;
  quote?: PendleConvertQuote;
  isRedeemMode: boolean;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  legalBatchTxUrl?: string;
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

export const PendleTransactionReview = ({
  market,
  flow,
  amount,
  quote,
  isRedeemMode,
  batchEnabled,
  setBatchEnabled,
  legalBatchTxUrl
}: PendleTransactionReviewProps) => {
  const { i18n } = useLingui();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setTxDescription
  } = useContext(WidgetContext);

  const underlyingToken = useMemo(() => buildUnderlyingToken(market), [market]);
  const ptToken = useMemo(() => buildPtToken(market), [market]);

  const originToken = flow === PendleFlow.BUY ? underlyingToken : ptToken;
  const targetToken = flow === PendleFlow.BUY ? ptToken : underlyingToken;
  const originAmount = amount;
  const targetAmount = quote?.amountOut;

  // Push origin/target token + amount into context so TransactionDetail
  // (the default fallback rendered by TransactionReview) can show the
  // "input → output" tile.
  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
  }, [originToken, originAmount, targetToken, targetAmount, setOriginToken, setOriginAmount, setTargetToken, setTargetAmount]);

  // Push title/subtitle/stepper copy.
  useEffect(() => {
    if (flow === PendleFlow.BUY) {
      setTxTitle(i18n._(pendleBuyReviewTitle));
      setTxSubtitle(i18n._(getPendleBuyReviewSubtitle(market.underlyingSymbol)));
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
        i18n._(getPendleWithdrawReviewSubtitle(`PT-${market.underlyingSymbol}`, market.underlyingSymbol))
      );
      setStepTwoTitle(t`Withdraw`);
    }
    setTxDescription(i18n._(getPendleActionDescription(flow, isRedeemMode, market.underlyingSymbol)));
  }, [flow, isRedeemMode, i18n.locale, market.underlyingSymbol, setTxTitle, setTxSubtitle, setStepTwoTitle, setTxDescription]);

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
    />
  );
};
