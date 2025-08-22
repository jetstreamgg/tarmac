import { Token } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';
import { formatUnits } from 'viem';

interface UseUpgradeTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originAmount: bigint;
  originToken: Token;
  targetToken: Token;
  tabIndex: 0 | 1;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  retryPrepareAction: () => void;
}

export const useUpgradeTransactionCallbacks = ({
  originAmount,
  originToken,
  targetToken,
  tabIndex,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  retryPrepareAction,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseUpgradeTransactionCallbacksParameters) => {
  const { handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Upgrade approve
  const approveTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Approving ${formatUnits(originAmount, 18)} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved ${formatUnits(originAmount, 18)} ${originToken.symbol}`
        });
        mutateAllowance();
        retryPrepareAction();
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
    [
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      originAmount,
      originToken.symbol,
      retryPrepareAction
    ]
  );

  // Upgrade action manager
  const upgradeManagerTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription:
            tabIndex === 0
              ? t`Upgrade ${originToken.symbol} into ${targetToken.symbol}`
              : t`Revert ${originToken.symbol} into ${targetToken.symbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: tabIndex === 0 ? t`Upgrade successful` : t`Revert successful`,
          notificationDescription:
            tabIndex === 0
              ? t`You upgraded ${formatUnits(originAmount, 18)} ${originToken.symbol} into ${
                  targetToken.symbol
                }`
              : t`You reverted ${formatUnits(originAmount, 18)} ${originToken.symbol} into ${
                  targetToken.symbol
                }`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: tabIndex === 0 ? t`Upgrade failed` : t`Revert failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
      }
    }),
    [
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      originToken.symbol,
      tabIndex,
      targetToken.symbol
    ]
  );

  return { approveTransactionCallbacks, upgradeManagerTransactionCallbacks };
};
