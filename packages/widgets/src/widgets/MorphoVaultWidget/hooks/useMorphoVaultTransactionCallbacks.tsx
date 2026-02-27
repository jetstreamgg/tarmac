import { formatBigInt } from '@jetstreamgg/sky-utils';
import { MorphoVaultReward } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useContext, useMemo, useRef } from 'react';
import { MorphoVaultAction, MorphoVaultFlow, MorphoVaultScreen } from '../lib/constants';

interface UseMorphoVaultTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  amount: bigint;
  /** Decimals of the underlying asset token */
  assetDecimals: number;
  /** Symbol of the underlying asset token */
  assetSymbol: string;
  /** The Morpho vault address */
  vaultAddress: `0x${string}`;
  /** The underlying asset address */
  assetAddress: `0x${string}`;
  /** Display name for the vault */
  vaultName: string;
  /** Rewards data for claim events */
  rewards?: MorphoVaultReward[];
  /** Whether the supply flow requires a token approval step */
  needsAllowance: boolean;
  /** Whether batch mode is active (approve+deposit bundled into one call) */
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateVaultData: () => void;
  mutateAssetBalance: () => void;
  mutateRewards?: () => void;
}

export const useMorphoVaultTransactionCallbacks = ({
  amount,
  assetDecimals,
  assetSymbol,
  vaultAddress,
  assetAddress,
  vaultName,
  rewards,
  needsAllowance,
  shouldUseBatch,
  mutateAllowance,
  mutateVaultData,
  mutateAssetBalance,
  mutateRewards,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseMorphoVaultTransactionCallbacksParameters) => {
  const { setWidgetState } = useContext(WidgetContext);
  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const vaultData = { module: 'morpho', product: vaultName, productAddress: vaultAddress, assetAddress, assetSymbol, isBatchTx: shouldUseBatch };

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
          action: isApproveStep ? MorphoVaultAction.APPROVE : MorphoVaultAction.SUPPLY,
          flow: MorphoVaultFlow.SUPPLY,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, { unit: assetDecimals })} ${assetSymbol}`
        });
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
          action: MorphoVaultAction.SUPPLY,
          flow: MorphoVaultFlow.SUPPLY,
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
          action: MorphoVaultAction.SUPPLY,
          flow: MorphoVaultFlow.SUPPLY,
          txHash: hash,
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
          action: MorphoVaultAction.WITHDRAW,
          flow: MorphoVaultFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: vaultData
        });
      },
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
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: MorphoVaultAction.WITHDRAW,
          flow: MorphoVaultFlow.WITHDRAW,
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
          action: MorphoVaultAction.WITHDRAW,
          flow: MorphoVaultFlow.WITHDRAW,
          txHash: hash,
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
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: MorphoVaultAction.CLAIM,
          flow: MorphoVaultFlow.CLAIM,
          assetSymbol,
          data: {
            ...vaultData,
            claimedRewards: rewards
              ?.filter(r => r.amount > 0n)
              .map(r => ({
                tokenSymbol: r.tokenSymbol,
                amount: Number(formatUnits(r.amount, r.tokenDecimals)),
                tokenAddress: r.tokenAddress
              }))
          }
        });
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
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: MorphoVaultAction.CLAIM,
          flow: MorphoVaultFlow.CLAIM,
          txHash: hash,
          assetSymbol,
          data: {
            ...vaultData,
            claimedRewards: rewards
              ?.filter(r => r.amount > 0n)
              .map(r => ({
                tokenSymbol: r.tokenSymbol,
                amount: Number(formatUnits(r.amount, r.tokenDecimals)),
                tokenAddress: r.tokenAddress
              }))
          }
        });
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Claim failed`,
          notificationDescription: t`Something went wrong with claiming your rewards. Please try again.`
        });
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: MorphoVaultAction.CLAIM,
          flow: MorphoVaultFlow.CLAIM,
          txHash: hash,
          assetSymbol,
          data: vaultData
        });
      }
    }),
    [
      rewards,
      vaultAddress,
      assetAddress,
      vaultName,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateRewards,
      setWidgetState,
      onAnalyticsEvent
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks, claimRewardsTransactionCallbacks };
};
