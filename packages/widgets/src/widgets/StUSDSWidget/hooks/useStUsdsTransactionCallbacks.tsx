import { formatBigInt } from '@jetstreamgg/sky-utils';
import { StUsdsProviderType } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';

interface UseStUsdsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  mutateNativeSupplyAllowance: () => void;
  mutateStUsds: () => void;
  mutateCurveUsdsAllowance?: () => void;
  mutateCurveStUsdsAllowance?: () => void;
  selectedProvider?: StUsdsProviderType;
}

export const useStUsdsTransactionCallbacks = ({
  amount,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateNativeSupplyAllowance,
  mutateStUsds,
  mutateCurveUsdsAllowance,
  mutateCurveStUsdsAllowance,
  selectedProvider = StUsdsProviderType.NATIVE
}: UseStUsdsTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const isCurve = selectedProvider === StUsdsProviderType.CURVE;

  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateNativeSupplyAllowance();
        if (isCurve) {
          mutateCurveUsdsAllowance?.();
        }
        handleOnMutate();
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
      },
      onError: (error, hash) => {
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
      }
    }),
    [
      amount,
      isCurve,
      handleOnMutate,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateNativeSupplyAllowance,
      mutateStUsds,
      mutateCurveUsdsAllowance
    ]
  );

  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        if (isCurve) {
          mutateCurveStUsdsAllowance?.();
        }
        handleOnMutate();
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
      },
      onError: (error, hash) => {
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
      }
    }),
    [
      amount,
      isCurve,
      handleOnMutate,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateStUsds,
      mutateCurveStUsdsAllowance
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
