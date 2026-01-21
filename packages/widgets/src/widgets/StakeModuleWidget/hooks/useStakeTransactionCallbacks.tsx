import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';

interface UseStakeTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  lockAmount: bigint;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  setRewardContractsToClaim: React.Dispatch<React.SetStateAction<`0x${string}`[] | undefined>>;
  setRestakeSkyRewards: React.Dispatch<React.SetStateAction<boolean>>;
  setRestakeSkyAmount: React.Dispatch<React.SetStateAction<bigint>>;
  mutateStakeUsdsAllowance: () => void;
  mutateStakeSkyAllowance: () => void;
}

export const useStakeTransactionCallbacks = ({
  lockAmount,
  setIndexToClaim,
  setRewardContractsToClaim,
  setRestakeSkyRewards,
  setRestakeSkyAmount,
  mutateStakeSkyAllowance,
  mutateStakeUsdsAllowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStakeTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const multicallTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateStakeSkyAllowance();
        mutateStakeUsdsAllowance();
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
        setIndexToClaim(undefined);
        setRewardContractsToClaim(undefined);
        setRestakeSkyRewards(false);
        setRestakeSkyAmount(0n);
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
      mutateStakeUsdsAllowance,
      setIndexToClaim,
      setRewardContractsToClaim,
      setRestakeSkyAmount,
      setRestakeSkyRewards
    ]
  );

  const claimTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: handleOnMutate,
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
        setRewardContractsToClaim(undefined);
        setRestakeSkyRewards(false);
        setRestakeSkyAmount(0n);
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
      setRewardContractsToClaim,
      setRestakeSkyAmount,
      setRestakeSkyRewards
    ]
  );

  return { multicallTransactionCallbacks, claimTransactionCallbacks };
};
