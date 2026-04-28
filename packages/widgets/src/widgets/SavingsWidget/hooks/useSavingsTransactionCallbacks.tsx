import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { SavingsAction, SavingsFlow } from '../lib/constants';

interface UseSavingsTransactionCallbacksParameters extends Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'
> {
  amount: bigint;
  assetDecimals: number;
  assetSymbol: string;
  assetAddress: `0x${string}`;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateSavings: () => void;
  mutateOriginBalance: () => void;
}

export const useSavingsTransactionCallbacks = ({
  amount,
  assetDecimals,
  assetSymbol,
  assetAddress,
  needsAllowance,
  shouldUseBatch,
  mutateAllowance,
  mutateSavings,
  mutateOriginBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseSavingsTransactionCallbacksParameters) => {
  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const savingsData = { module: 'savings', assetAddress, assetSymbol, isBatchTx: shouldUseBatch };

  // Tracks which step of a multi-call supply flow we're on (approve → deposit)
  const supplyStepRef = useRef(0);

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // Silently swallow — analytics must never break functionality
    }
  };

  // Savings supply
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = supplyStepRef.current;
        supplyStepRef.current++;
        // In batch mode, approve+deposit are bundled — single onMutate is always the main action
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
          recentTransactionDescription: t`Supplying ${formatBigInt(amount)} USDS`
        });
      },
      onSuccess: hash => {
        supplyStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount)} USDS`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSavings();
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
        const failedAtApproveStep = needsAllowance && !shouldUseBatch && supplyStepRef.current === 1;
        const failedAction = failedAtApproveStep ? SavingsAction.APPROVE : SavingsAction.SUPPLY;

        supplyStepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateSavings();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: failedAction,
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
      mutateAllowance,
      mutateSavings,
      mutateOriginBalance,
      onAnalyticsEvent
    ]
  );

  // Savings withdraw
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: SavingsAction.WITHDRAW,
          flow: SavingsFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: savingsData
        });
      },
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: t`Withdrawing ${formatBigInt(amount)} USDS` });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount)} USDS`
        });
        mutateSavings();
        mutateOriginBalance();
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
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdraw. Please try again.`
        });
        mutateAllowance();
        mutateSavings();
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
      assetDecimals,
      assetSymbol,
      assetAddress,
      formattedAmount,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      mutateSavings,
      mutateOriginBalance,
      onAnalyticsEvent
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
