import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { formatUnits } from 'viem';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { useChainId } from 'wagmi';
import { SavingsAction, SavingsFlow } from '@widgets/widgets/SavingsWidget/lib/constants';

interface UseL2SavingsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  amount: bigint;
  originToken: Token;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateSUsdsBalance: () => void;
}

export const useL2SavingsTransactionCallbacks = ({
  amount,
  originToken,
  needsAllowance,
  shouldUseBatch,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  mutateAllowance,
  mutateOriginBalance,
  mutateSUsdsBalance
}: UseL2SavingsTransactionCallbacksParameters) => {
  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const chainId = useChainId();
  const { i18n } = useLingui();
  const locale = i18n.locale;

  const assetDecimals = getTokenDecimals(originToken, chainId);
  const assetSymbol = originToken.symbol;
  const assetAddress = originToken.address[chainId] as `0x${string}`;
  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const savingsData = { module: 'savings', assetAddress, assetSymbol, isBatchTx: shouldUseBatch };

  // Tracks which step of a multi-call flow we're on (approve → action)
  const supplyStepRef = useRef(0);
  const withdrawStepRef = useRef(0);

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // Silently swallow — analytics must never break functionality
    }
  };

  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = supplyStepRef.current;
        supplyStepRef.current++;
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        mutateAllowance();
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? SavingsAction.APPROVE : SavingsAction.SUPPLY,
          flow: SavingsFlow.SUPPLY,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        supplyStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: SavingsAction.SUPPLY,
          flow: SavingsFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      },
      onError: (error, hash) => {
        supplyStepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: SavingsAction.SUPPLY,
          flow: SavingsFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      }
    }),
    [
      amount,
      chainId,
      assetDecimals,
      assetSymbol,
      assetAddress,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken,
      onAnalyticsEvent
    ]
  );
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = withdrawStepRef.current;
        withdrawStepRef.current++;
        // L2 withdrawals go through PSM and may need sUSDS allowance
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        mutateAllowance();
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? SavingsAction.APPROVE : SavingsAction.WITHDRAW,
          flow: SavingsFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Withdrawing ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        withdrawStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: SavingsAction.WITHDRAW,
          flow: SavingsFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      },
      onError: (error, hash) => {
        withdrawStepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdraw. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: SavingsAction.WITHDRAW,
          flow: SavingsFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      }
    }),
    [
      amount,
      chainId,
      assetDecimals,
      assetSymbol,
      assetAddress,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken,
      onAnalyticsEvent
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
