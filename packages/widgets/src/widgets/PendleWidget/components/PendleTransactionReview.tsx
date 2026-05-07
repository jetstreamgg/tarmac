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
  pendleWithdrawReviewTitle,
  getPendleBuyReviewSubtitle,
  getPendleWithdrawReviewSubtitle,
  getPendleActionDescription
} from '../lib/constants';

type PendleTransactionReviewProps = {
  market: PendleMarketConfig;
  originToken: Token;
  targetToken: Token;
  amount: bigint;
  quote?: PendleConvertQuote;
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

  // Push origin/target token + amount into context so TransactionDetail
  // (the default fallback rendered by TransactionReview) can show the
  // "input → output" tile.
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

  // Push title/subtitle/stepper copy.
  // Multi-token: copy that names the user-side token comes from the selected
  // token's symbol (originToken on BUY, targetToken on SELL), not from
  // market.underlyingSymbol — those can differ now (e.g. user supplies USDC
  // into a PT-USDG market).
  const userSideSymbol = flow === PendleFlow.BUY ? originToken.symbol : targetToken.symbol;
  useEffect(() => {
    const batchStatus =
      !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED;

    if (flow === PendleFlow.BUY) {
      setTxTitle(i18n._(pendleBuyReviewTitle));
      setTxSubtitle(
        i18n._(
          getPendleBuyReviewSubtitle({
            batchStatus,
            symbol: userSideSymbol,
            needsAllowance
          })
        )
      );
      setStepTwoTitle(t`Supply`);
    } else {
      setTxTitle(i18n._(pendleWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getPendleWithdrawReviewSubtitle({
            batchStatus,
            ptSymbol: `PT-${market.underlyingSymbol}`,
            underlyingSymbol: userSideSymbol,
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
          needsAllowance,
          underlyingSymbol: userSideSymbol
        })
      )
    );
  }, [
    flow,
    action,
    screen,
    needsAllowance,
    isBatchTransaction,
    batchSupported,
    batchEnabled,
    txStatus,
    i18n.locale,
    market.underlyingSymbol,
    userSideSymbol,
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
