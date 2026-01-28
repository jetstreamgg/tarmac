import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { useContext, useMemo } from 'react';
import { MorphoVaultAction, MorphoVaultFlow, MorphoVaultScreen } from '../lib/constants';

interface UseMorphoVaultTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  /** Decimals of the underlying asset token */
  assetDecimals: number;
  /** Symbol of the underlying asset token */
  assetSymbol: string;
  mutateAllowance: () => void;
  mutateVaultData: () => void;
  mutateAssetBalance: () => void;
  mutateRewards?: () => void;
}

export const useMorphoVaultTransactionCallbacks = ({
  amount,
  assetDecimals,
  assetSymbol,
  mutateAllowance,
  mutateVaultData,
  mutateAssetBalance,
  mutateRewards,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseMorphoVaultTransactionCallbacksParameters) => {
  const { setWidgetState } = useContext(WidgetContext);
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Supply transaction callbacks
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
        mutateAllowance();
        mutateAssetBalance();
        mutateVaultData();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateVaultData();
      }
    }),
    [
      amount,
      assetDecimals,
      assetSymbol,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      mutateVaultData,
      mutateAssetBalance
    ]
  );

  // Withdraw transaction callbacks
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: handleOnMutate,
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Withdrawing ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
        mutateVaultData();
        mutateAssetBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdrawal. Please try again.`
        });
        mutateVaultData();
      }
    }),
    [
      amount,
      assetDecimals,
      assetSymbol,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateVaultData,
      mutateAssetBalance
    ]
  );

  // Claim rewards transaction callbacks
  const claimRewardsTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        handleOnMutate();
        setWidgetState((prev: WidgetState) => ({
          ...prev,
          flow: MorphoVaultFlow.CLAIM,
          action: MorphoVaultAction.CLAIM,
          screen: MorphoVaultScreen.TRANSACTION
        }));
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Claiming rewards`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Claim successful`,
          notificationDescription: t`You claimed your rewards`
        });
        mutateRewards?.();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Claim failed`,
          notificationDescription: t`Something went wrong with claiming your rewards. Please try again.`
        });
      }
    }),
    [handleOnError, handleOnMutate, handleOnStart, handleOnSuccess, mutateRewards, setWidgetState]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks, claimRewardsTransactionCallbacks };
};
