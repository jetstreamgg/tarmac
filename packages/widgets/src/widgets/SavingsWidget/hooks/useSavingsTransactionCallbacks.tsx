import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';

interface UseSavingsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  mutateAllowance: () => void;
  mutateSavings: () => void;
  retryPrepareSupply: () => void;
}

export const useSavingsTransactionCallbacks = ({
  amount,
  mutateAllowance,
  mutateSavings,
  retryPrepareSupply,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseSavingsTransactionCallbacksParameters) => {
  const { handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Savings approve
  const approveTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: t`Approving ${formatBigInt(amount)} USDS` });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved USDS`
        });
        mutateAllowance();
        retryPrepareSupply();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateAllowance();
      }
    }),
    [amount, handleOnError, handleOnStart, handleOnSuccess, mutateAllowance, retryPrepareSupply]
  );

  // Savings supply
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount)} USDS`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount)} USDS`
        });
        mutateAllowance();
        mutateSavings();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateSavings();
      }
    }),
    [amount, handleOnError, handleOnStart, handleOnSuccess, mutateAllowance, mutateSavings]
  );

  // Savings withdraw
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
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
      }
    }),
    [amount, handleOnError, handleOnStart, handleOnSuccess, mutateAllowance, mutateSavings]
  );

  return { approveTransactionCallbacks, supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
