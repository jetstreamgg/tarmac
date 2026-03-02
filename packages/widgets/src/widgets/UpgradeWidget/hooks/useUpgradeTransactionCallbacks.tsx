import { Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { UpgradeAction, UpgradeFlow } from '../lib/constants';

interface UseUpgradeTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  originAmount: bigint;
  originToken: Token;
  targetToken: Token;
  tabIndex: 0 | 1;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  shouldAllowExternalUpdate: React.RefObject<boolean>;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
}

export const useUpgradeTransactionCallbacks = ({
  originAmount,
  originToken,
  targetToken,
  tabIndex,
  needsAllowance,
  shouldUseBatch,
  shouldAllowExternalUpdate,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseUpgradeTransactionCallbacksParameters) => {
  const chainId = useChainId();

  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Tracks which step of a multi-call flow we're on (approve → action)
  const stepRef = useRef(0);

  const isUpgrade = tabIndex === 0;
  const flow = isUpgrade ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT;
  const actionType = isUpgrade ? UpgradeAction.UPGRADE : UpgradeAction.REVERT;
  const assetDecimals = getTokenDecimals(originToken, chainId);
  const assetSymbol = originToken.symbol;
  const formattedAmount = Number(formatUnits(originAmount, assetDecimals));
  const upgradeData = {
    module: 'upgrade',
    assetAddress: originToken.address[chainId],
    assetSymbol,
    targetSymbol: targetToken.symbol,
    targetAddress: targetToken.address[chainId],
    isBatchTx: shouldUseBatch
  };

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // Silently swallow — analytics must never break functionality
    }
  };

  // Upgrade action manager
  const upgradeManagerTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = stepRef.current;
        stepRef.current++;
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        shouldAllowExternalUpdate.current = false;
        mutateAllowance();
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? UpgradeAction.APPROVE : actionType,
          flow,
          amount: formattedAmount,
          assetSymbol,
          data: upgradeData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: isUpgrade
            ? t`Upgrade ${originToken.symbol} into ${targetToken.symbol}`
            : t`Revert ${originToken.symbol} into ${targetToken.symbol}`
        });
      },
      onSuccess: hash => {
        stepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: isUpgrade ? t`Upgrade successful` : t`Revert successful`,
          notificationDescription: isUpgrade
            ? t`You upgraded ${formatUnits(originAmount, 18)} ${originToken.symbol} into ${targetToken.symbol}`
            : t`You reverted ${formatUnits(originAmount, 18)} ${originToken.symbol} into ${targetToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: actionType,
          flow,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: upgradeData
        });
      },
      onError: (error, hash) => {
        stepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: isUpgrade ? t`Upgrade failed` : t`Revert failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: actionType,
          flow,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: upgradeData
        });
      }
    }),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      originToken.symbol,
      tabIndex,
      targetToken.symbol,
      shouldAllowExternalUpdate,
      onAnalyticsEvent
    ]
  );

  return { upgradeManagerTransactionCallbacks };
};
