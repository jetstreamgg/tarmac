import { formatBigInt } from '@/utils';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { useTransactionCallbacks } from '@/widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@/widgets/shared/types/transactionCallbacks';
import {
  WidgetProps,
  OnNotificationCallback,
  OnAnalyticsEventCallback
} from '@/widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { VaultAction, VaultFlow } from '../lib/constants';

interface UseVaultTransactionCallbacksParameters extends Pick<WidgetProps, 'onWidgetStateChange'> {
  onNotification?: OnNotificationCallback;
  onAnalyticsEvent?: OnAnalyticsEventCallback;
  amount: bigint;
  /** Decimals of the underlying asset token */
  assetDecimals: number;
  /** Symbol of the underlying asset token */
  assetSymbol: string;
  /** The vault address */
  vaultAddress: `0x${string}`;
  /** The underlying asset address */
  assetAddress: `0x${string}`;
  /** Display name for the vault */
  vaultName: string;
  /** Whether the supply flow requires a token approval step */
  needsAllowance: boolean;
  /** Whether batch mode is active (approve+deposit bundled into one call) */
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateVaultData: () => void;
  mutateAssetBalance: () => void;
}

export const useVaultTransactionCallbacks = ({
  amount,
  assetDecimals,
  assetSymbol,
  vaultAddress,
  assetAddress,
  vaultName,
  needsAllowance,
  shouldUseBatch,
  mutateAllowance,
  mutateVaultData,
  mutateAssetBalance,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseVaultTransactionCallbacksParameters) => {
  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    onWidgetStateChange,
    onNotification
  });

  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const vaultData = {
    module: 'morpho',
    product: vaultName,
    productAddress: vaultAddress,
    assetAddress,
    assetSymbol,
    isBatchTx: shouldUseBatch
  };

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

  // Supply transaction callbacks
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
          action: isApproveStep ? VaultAction.APPROVE : VaultAction.SUPPLY,
          flow: VaultFlow.SUPPLY,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      },
      onStart: hash => {
        handleOnStart({ hash });
      },
      onSuccess: hash => {
        supplyStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
        mutateAllowance();
        mutateAssetBalance();
        mutateVaultData();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: VaultAction.SUPPLY,
          flow: VaultFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
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
        mutateVaultData();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: VaultAction.SUPPLY,
          flow: VaultFlow.SUPPLY,
          txHash: hash,
          error,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      }
    }),
    [
      amount,
      assetDecimals,
      assetSymbol,
      formattedAmount,
      vaultAddress,
      assetAddress,
      vaultName,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      mutateVaultData,
      mutateAssetBalance,
      onAnalyticsEvent
    ]
  );

  // Withdraw transaction callbacks
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: VaultAction.WITHDRAW,
          flow: VaultFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      },
      onStart: hash => {
        handleOnStart({ hash });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
        mutateVaultData();
        mutateAssetBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: VaultAction.WITHDRAW,
          flow: VaultFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdrawal. Please try again.`
        });
        mutateVaultData();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: VaultAction.WITHDRAW,
          flow: VaultFlow.WITHDRAW,
          txHash: hash,
          error,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      }
    }),
    [
      amount,
      assetDecimals,
      assetSymbol,
      formattedAmount,
      vaultAddress,
      assetAddress,
      vaultName,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateVaultData,
      mutateAssetBalance,
      onAnalyticsEvent
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
