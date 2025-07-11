import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useContext, useMemo } from 'react';

interface UseStakeTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  lockAmount: bigint;
  usdsAmount: bigint;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  setRewardContractToClaim: React.Dispatch<React.SetStateAction<`0x${string}` | undefined>>;
  mutateStakeSkyAllowance: () => void;
  mutateStakeUsdsAllowance: () => void;
  retryPrepareMulticall: () => void;
}

export const useStakeTransactionCallbacks = ({
  lockAmount,
  usdsAmount,
  setIndexToClaim,
  setRewardContractToClaim,
  mutateStakeSkyAllowance,
  mutateStakeUsdsAllowance,
  retryPrepareMulticall,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStakeTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { setShowStepIndicator } = useContext(WidgetContext);

  const approveSkyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        setShowStepIndicator(true);
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Approving ${formatBigInt(lockAmount)} SKY`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved SKY`
        });
        mutateStakeSkyAllowance();
        retryPrepareMulticall();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateStakeSkyAllowance();
      }
    }),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      lockAmount,
      mutateStakeSkyAllowance,
      retryPrepareMulticall,
      setShowStepIndicator
    ]
  );

  const approveUsdsTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        setShowStepIndicator(true);
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Approving ${formatBigInt(usdsAmount)} USDS`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved USDS`
        });
        mutateStakeUsdsAllowance();
        retryPrepareMulticall();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateStakeUsdsAllowance();
      }
    }),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateStakeUsdsAllowance,
      retryPrepareMulticall,
      setShowStepIndicator,
      usdsAmount
    ]
  );

  const multicallTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        setShowStepIndicator(true);
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: t`Doing multicall` });
      },
      onSuccess: hash => {
        //TODO: fix all this copy
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved ${formatBigInt(lockAmount)} SKY` /* TODO fix copy */
        });
        mutateStakeSkyAllowance();
        // TODO Mutate balances here
      },
      onError: (error, hash) => {
        //TODO: fix all this copy
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateStakeSkyAllowance();
      }
    }),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      lockAmount,
      mutateStakeSkyAllowance,
      setShowStepIndicator
    ]
  );

  const claimTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        setShowStepIndicator(false);
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: 'Claiming rewards' });
      },
      onSuccess: hash => {
        //TODO: Update copy
        handleOnSuccess({
          hash,
          notificationTitle: t`Claim successful`,
          notificationDescription: t`You claimed your rewards`
        });
        // TODO: `useRewardsRewardsBalance` invalidates the query after every block,
        // do we need to invalidate it again here?
        // mutateRewardsBalance();
        setIndexToClaim(undefined);
        setRewardContractToClaim(undefined);
      },
      onError: (error, hash) => {
        //TODO: Update copy
        handleOnError({
          error,
          hash,
          notificationTitle: t`Claim failed`,
          notificationDescription: t`We could not claim your rewards.`
        });
      }
    }),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      setIndexToClaim,
      setRewardContractToClaim,
      setShowStepIndicator
    ]
  );

  return {
    approveSkyTransactionCallbacks,
    approveUsdsTransactionCallbacks,
    multicallTransactionCallbacks,
    claimTransactionCallbacks
  };
};
