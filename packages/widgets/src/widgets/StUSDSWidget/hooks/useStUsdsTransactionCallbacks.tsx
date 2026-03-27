import { formatBigInt } from '@jetstreamgg/sky-utils';
import { StUsdsProviderType, stUsdsAddress } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { useChainId } from 'wagmi';
import { StUSDSAction, StUSDSFlow } from '../lib/constants';

interface UseStUsdsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  amount: bigint;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  mutateNativeSupplyAllowance: () => void;
  mutateStUsds: () => void;
  mutateCurveUsdsAllowance?: () => void;
  mutateCurveStUsdsAllowance?: () => void;
  selectedProvider?: StUsdsProviderType;
}

export const useStUsdsTransactionCallbacks = ({
  amount,
  needsAllowance,
  shouldUseBatch,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  mutateNativeSupplyAllowance,
  mutateStUsds,
  mutateCurveUsdsAllowance,
  mutateCurveStUsdsAllowance,
  selectedProvider = StUsdsProviderType.NATIVE
}: UseStUsdsTransactionCallbacksParameters) => {
  const chainId = useChainId();

  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const isCurve = selectedProvider === StUsdsProviderType.CURVE;
  const assetDecimals = 18; // USDS is always 18 decimals
  const assetSymbol = 'USDS';
  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const productAddress = stUsdsAddress[chainId as keyof typeof stUsdsAddress];
  const stUsdsData = {
    module: 'expert',
    product: 'stUSDS',
    productAddress,
    assetSymbol,
    isBatchTx: shouldUseBatch,
    provider: isCurve ? 'curve' : 'native'
  };

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

        mutateNativeSupplyAllowance();
        if (isCurve) {
          mutateCurveUsdsAllowance?.();
        }
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? StUSDSAction.APPROVE : StUSDSAction.SUPPLY,
          flow: StUSDSFlow.SUPPLY,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: isCurve
            ? t`Supplying ${formatBigInt(amount)} USDS via Curve`
            : t`Supplying ${formatBigInt(amount)} USDS`
        });
      },
      onSuccess: hash => {
        supplyStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: isCurve
            ? t`You supplied ${formatBigInt(amount)} USDS for stUSDS via Curve`
            : t`You supplied ${formatBigInt(amount)} USDS`
        });
        mutateNativeSupplyAllowance();
        mutateStUsds();
        if (isCurve) {
          mutateCurveUsdsAllowance?.();
        }
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: StUSDSAction.SUPPLY,
          flow: StUSDSFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
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
        mutateNativeSupplyAllowance();
        mutateStUsds();
        if (isCurve) {
          mutateCurveUsdsAllowance?.();
        }
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: StUSDSAction.SUPPLY,
          flow: StUSDSFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
        });
      }
    }),
    [
      amount,
      isCurve,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      handleOnMutate,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateNativeSupplyAllowance,
      mutateStUsds,
      mutateCurveUsdsAllowance,
      onAnalyticsEvent
    ]
  );

  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = withdrawStepRef.current;
        withdrawStepRef.current++;
        // Curve withdrawals need stUSDS allowance for the pool
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        if (isCurve) {
          mutateCurveStUsdsAllowance?.();
        }
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? StUSDSAction.APPROVE : StUSDSAction.WITHDRAW,
          flow: StUSDSFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: isCurve
            ? t`Withdrawing ${formatBigInt(amount)} USDS via Curve`
            : t`Withdrawing ${formatBigInt(amount)} USDS`
        });
      },
      onSuccess: hash => {
        withdrawStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: isCurve
            ? t`You withdrew ${formatBigInt(amount)} USDS from stUSDS via Curve`
            : t`You withdrew ${formatBigInt(amount)} USDS`
        });
        mutateStUsds();
        if (isCurve) {
          mutateCurveStUsdsAllowance?.();
        }
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: StUSDSAction.WITHDRAW,
          flow: StUSDSFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
        });
      },
      onError: (error, hash) => {
        withdrawStepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateStUsds();
        if (isCurve) {
          mutateCurveStUsdsAllowance?.();
        }
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: StUSDSAction.WITHDRAW,
          flow: StUSDSFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: stUsdsData
        });
      }
    }),
    [
      amount,
      isCurve,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      handleOnMutate,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateStUsds,
      mutateCurveStUsdsAllowance,
      onAnalyticsEvent
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
