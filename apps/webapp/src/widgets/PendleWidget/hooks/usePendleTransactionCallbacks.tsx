import { useRef } from 'react';
import { t } from '@lingui/core/macro';
import { getTransactionLink } from '@/utils';
import {
  PendleConvertSide,
  useAllPendleMarketsHistory,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { TxStatus } from '@/widgets/shared/constants';
import {
  WidgetState,
  OnNotificationCallback,
  OnAnalyticsEventCallback
} from '@/widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { PENDLE_HISTORY_REFRESH_MS, PendleFlow, PendleScreen } from '../lib/constants';
import { pendleAnalyticsData, type PendleAnalyticsSide } from '../lib/pendleAnalyticsData';
import { pendleNonPtLeg } from '../lib/pendleUsdValue';

type UsePendleTransactionCallbacksParameters = {
  onAnalyticsEvent?: OnAnalyticsEventCallback;
  onNotification?: OnNotificationCallback;
  /** Values a token leg in USD for the analytics `amount` property. */
  valueUsd: (symbol: string, amount: number) => number | undefined;
  flow: PendleFlow;
  side: PendleConvertSide;
  market: PendleMarketConfig;
  originToken: Token;
  targetToken: Token;
  amount: bigint;
  fromDecimals: number;
  toDecimals: number;
  slippage: number;
  quote?: PendleConvertQuote;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  chainId: number;
  address?: `0x${string}`;
  isSafeWallet: boolean;
  setTxStatus: (status: TxStatus) => void;
  setExternalLink: (link: string | undefined) => void;
  setWidgetState: (updater: (prev: WidgetState) => WidgetState) => void;
  refetchInputBalance: () => void;
  refetchOutputBalance: () => void;
  refetchPtBalance: () => void;
};

export function usePendleTransactionCallbacks({
  flow,
  side,
  market,
  originToken,
  targetToken,
  amount,
  fromDecimals,
  toDecimals,
  slippage,
  quote,
  needsAllowance,
  shouldUseBatch,
  chainId,
  address,
  isSafeWallet,
  setTxStatus,
  setExternalLink,
  setWidgetState,
  refetchInputBalance,
  refetchOutputBalance,
  refetchPtBalance,
  onNotification,
  onAnalyticsEvent,
  valueUsd
}: UsePendleTransactionCallbacksParameters) {
  // Tracks which step of a non-batch sequence we're on (approve → main).
  const supplyStepRef = useRef(0);

  const { mutate: refreshPendleHistory } = useAllPendleMarketsHistory();

  const mainAction: 'supply' | 'withdraw' = side === PendleConvertSide.BUY ? 'supply' : 'withdraw';
  const analyticsSide: PendleAnalyticsSide = side === PendleConvertSide.BUY ? 'buy' : 'sell';
  // `amount` = USD value of the non-PT leg (input on buy, output on sell), so
  // sUSDS supplies don't mis-sum the inflow/outflow tiles. useWidgetAnalytics
  // applies the withdraw sign — pass positive magnitude. Raw token counts stay
  // on amountFrom/amountTo in buildData(). undefined when price unavailable →
  // the event omits `amount` rather than emit a wrong-unit number.
  const leg = pendleNonPtLeg(analyticsSide, {
    originSymbol: originToken.symbol,
    targetSymbol: targetToken.symbol,
    amountInBigint: amount,
    amountOutBigint: quote?.amountOut ?? 0n,
    fromDecimals,
    toDecimals
  });
  const formattedAmount = valueUsd(leg.symbol, leg.amount);

  const buildData = () =>
    pendleAnalyticsData({
      market,
      side: analyticsSide,
      originToken,
      targetToken,
      amountFromBigint: amount,
      amountToBigint: quote?.amountOut ?? 0n,
      fromDecimals,
      toDecimals,
      slippage,
      quote,
      isBatchTx: shouldUseBatch
    });

  // Analytics must never break functionality.
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // swallow
    }
  };

  return {
    onMutate: () => {
      const step = supplyStepRef.current;
      supplyStepRef.current++;
      const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

      setTxStatus(TxStatus.INITIALIZED);
      setExternalLink(undefined);
      setWidgetState((prev: WidgetState) => ({ ...prev, screen: PendleScreen.TRANSACTION }));

      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action: isApproveStep ? 'approve' : mainAction,
        flow: mainAction,
        amount: formattedAmount,
        data: buildData()
      });
    },
    onStart: (hash: string | undefined) => {
      setTxStatus(TxStatus.LOADING);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
    },
    onSuccess: (hash: string | undefined) => {
      supplyStepRef.current = 0;
      refetchInputBalance();
      refetchOutputBalance();
      refetchPtBalance();
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      // Pendle's PnL indexer needs ~20s after the receipt lands to expose the
      // new row — see PENDLE_HISTORY_REFRESH_MS for measurements.
      setTimeout(refreshPendleHistory, PENDLE_HISTORY_REFRESH_MS);
      onNotification?.({
        title: flow === PendleFlow.BUY ? t`Supply complete` : t`Withdrawal complete`,
        description:
          flow === PendleFlow.BUY
            ? t`PT-${market.underlyingSymbol} delivered to your wallet.`
            : t`${targetToken.symbol} delivered to your wallet.`,
        status: TxStatus.SUCCESS
      });

      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
        action: mainAction,
        flow: mainAction,
        txHash: hash,
        amount: formattedAmount,
        data: buildData()
      });
    },
    onError: (err: Error, hash: string | undefined) => {
      supplyStepRef.current = 0;
      setTxStatus(TxStatus.ERROR);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onNotification?.({
        title: t`Transaction failed`,
        description: err.message,
        status: TxStatus.ERROR
      });

      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
        action: mainAction,
        flow: mainAction,
        txHash: hash,
        amount: formattedAmount,
        data: buildData()
      });
    }
  };
}
