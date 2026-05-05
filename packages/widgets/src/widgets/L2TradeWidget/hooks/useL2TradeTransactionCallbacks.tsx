import { getTokenDecimals, TokenForChain } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { notificationTypeMaping } from '@widgets/shared/constants';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useCallback, useContext, useMemo } from 'react';
import { useChainId } from 'wagmi';

interface UseL2TradeTransactionCallbacksParameters extends Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'
> {
  originAmount: bigint;
  originToken: TokenForChain | undefined;
  targetAmount: bigint;
  targetToken: TokenForChain | undefined;
  onAnalyticsEvent?: (event: WidgetAnalyticsEvent) => void;
  swapData: Record<string, unknown>;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  setShowAddToken: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useL2TradeTransactionCallbacks = ({
  originAmount,
  originToken,
  targetAmount,
  targetToken,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  swapData,
  setShowAddToken
}: UseL2TradeTransactionCallbacksParameters) => {
  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { setBackButtonText } = useContext(WidgetContext);
  const chainId = useChainId();
  const { i18n } = useLingui();
  const locale = i18n.locale;

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = useCallback(
    (event: WidgetAnalyticsEvent) => {
      try {
        onAnalyticsEvent?.(event);
      } catch {
        // Silently swallow — analytics must never break functionality
      }
    },
    [onAnalyticsEvent]
  );

  const tradeTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Trading ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Trade successful`,
          notificationDescription: t`You traded ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''} for ${formatBigInt(targetAmount, {
            locale,
            unit: targetToken && getTokenDecimals(targetToken, chainId)
          })} ${targetToken?.symbol ?? ''}`,
          notificationType: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
        });
        setBackButtonText(t`Back to Trade`);
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        setShowAddToken(true);
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: 'trade',
          flow: 'trade',
          txHash: hash,
          data: swapData
        });
      },
      onError: (error: Error, hash: string | undefined) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Trade failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: 'trade',
          flow: 'trade',
          txHash: hash,
          data: swapData
        });
      }
    }),
    [
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      originToken,
      setBackButtonText,
      setShowAddToken,
      targetAmount,
      targetToken,
      onAnalyticsEvent
    ]
  );

  const tradeOutTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Trading ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Trade successful`,
          notificationDescription: t`You traded ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''} for ${formatBigInt(targetAmount, {
            locale,
            unit: targetToken && getTokenDecimals(targetToken, chainId)
          })} ${targetToken?.symbol ?? ''}`,
          notificationType: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
        });
        setBackButtonText(t`Back to Trade`);
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        setShowAddToken(true);
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: 'trade',
          flow: 'trade',
          txHash: hash,
          data: swapData
        });
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Trade failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: 'trade',
          flow: 'trade',
          txHash: hash,
          data: swapData
        });
      }
    }),
    [
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      originToken,
      setBackButtonText,
      setShowAddToken,
      targetAmount,
      targetToken,
      onAnalyticsEvent
    ]
  );

  return { tradeTransactionCallbacks, tradeOutTransactionCallbacks };
};
