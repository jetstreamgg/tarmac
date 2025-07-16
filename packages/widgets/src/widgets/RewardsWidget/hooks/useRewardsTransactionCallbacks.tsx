import { RewardContract } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { useContext, useMemo } from 'react';
import { RewardsAction, RewardsScreen } from '../lib/constants';

interface UseRewardsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  selectedRewardContract: RewardContract | undefined;
  amount: bigint;
  rewardsBalance: bigint | undefined;
  mutateAllowance: () => void;
  mutateTokenBalance: () => void;
  mutateRewardsBalance: () => void;
  mutateUserSuppliedBalance: () => void;
  setClaimAmount: React.Dispatch<React.SetStateAction<bigint>>;
}

export const useRewardsTransactionCallbacks = ({
  selectedRewardContract,
  amount,
  rewardsBalance,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  setClaimAmount
}: UseRewardsTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { setWidgetState } = useContext(WidgetContext);
  const { i18n } = useLingui();
  const locale = i18n.locale;

  // Rewards supply
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
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
      handleOnMutate,
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
      onMutate: handleOnMutate,
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
      handleOnMutate,
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
      onMutate: () => {
        handleOnMutate();
        setClaimAmount(rewardsBalance || 0n);
        setWidgetState((prev: WidgetState) => ({
          ...prev,
          screen: RewardsScreen.TRANSACTION,
          action: RewardsAction.CLAIM
        }));
      },
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
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateRewardsBalance,
      mutateTokenBalance,
      rewardsBalance,
      setClaimAmount,
      setWidgetState
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks, claimTransactionCallbacks };
};
