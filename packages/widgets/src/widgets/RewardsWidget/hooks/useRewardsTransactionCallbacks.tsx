import { RewardContract } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';

interface UseRewardsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  selectedRewardContract: RewardContract | undefined;
  amount: bigint;
  mutateAllowance: () => void;
  mutateTokenBalance: () => void;
  mutateRewardsBalance: () => void;
  mutateUserSuppliedBalance: () => void;
  retryPrepareSupply: () => void;
}

export const useRewardsTransactionCallbacks = ({
  selectedRewardContract,
  amount,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance,
  retryPrepareSupply,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseRewardsTransactionCallbacksParameters) => {
  const { handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { i18n } = useLingui();
  const locale = i18n.locale;

  // Rewards approve
  const approveTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Approving ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
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
    [
      amount,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      retryPrepareSupply,
      selectedRewardContract?.supplyToken.name
    ]
  );

  // Rewards supply
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: (hash?: string) => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
      },
      onSuccess: (hash: string | undefined) => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
        mutateAllowance();
        mutateTokenBalance();
        mutateRewardsBalance();
        mutateUserSuppliedBalance();
      },
      onError: (error: Error, hash: string | undefined) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateTokenBalance();
      }
    }),
    [
      amount,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateRewardsBalance,
      mutateTokenBalance,
      mutateUserSuppliedBalance,
      selectedRewardContract?.supplyToken.name
    ]
  );

  // Rewards withdraw
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Withdrawing ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
        mutateTokenBalance();
        mutateRewardsBalance();
        mutateAllowance();
        mutateUserSuppliedBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdraw. Please try again.`
        });
        mutateTokenBalance();
        mutateAllowance();
      }
    }),
    [
      amount,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateRewardsBalance,
      mutateTokenBalance,
      mutateUserSuppliedBalance,
      selectedRewardContract?.supplyToken.name
    ]
  );

  // Rewards claim
  const claimTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: 'Claiming tokens' });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: 'Rewards claim successful',
          notificationDescription: 'You claimed your rewards!'
        });
        mutateRewardsBalance();
        mutateRewardsBalance();
        mutateTokenBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: 'Claim failed',
          notificationDescription: 'Something went wrong with claiming your rewards. Please try again.'
        });
        mutateTokenBalance();
      }
    }),
    [handleOnError, handleOnStart, handleOnSuccess, mutateRewardsBalance, mutateTokenBalance]
  );

  return {
    approveTransactionCallbacks,
    supplyTransactionCallbacks,
    withdrawTransactionCallbacks,
    claimTransactionCallbacks
  };
};
