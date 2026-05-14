import { useRef } from 'react';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { getTransactionLink } from '@/utils';
import {
  PendleConvertSide,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { TxStatus } from '@/widgets/shared/constants';
import { WidgetProps, WidgetState } from '@/widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { PendleFlow, PendleScreen } from '../lib/constants';
import { pendleAnalyticsData, type PendleAnalyticsSide } from '../lib/pendleAnalyticsData';

type UsePendleTransactionCallbacksParameters = Pick<WidgetProps, 'onNotification' | 'onAnalyticsEvent'> & {
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
  onAnalyticsEvent
}: UsePendleTransactionCallbacksParameters) {
  // Tracks which step of a non-batch sequence we're on (approve → main).
  const supplyStepRef = useRef(0);

  const mainAction: 'supply' | 'withdraw' = side === PendleConvertSide.BUY ? 'supply' : 'withdraw';
  const analyticsSide: PendleAnalyticsSide = side === PendleConvertSide.BUY ? 'buy' : 'sell';
  const formattedAmount = Number(formatUnits(amount, fromDecimals));

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
