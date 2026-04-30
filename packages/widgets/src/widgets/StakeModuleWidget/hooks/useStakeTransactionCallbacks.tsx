import { useRewardContractTokens } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useMemo, useRef } from 'react';
import { StakeFlow } from '../lib/constants';

interface UseStakeTransactionCallbacksParameters extends Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'
> {
  lockAmount: bigint;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  setRewardContractsToClaim: React.Dispatch<React.SetStateAction<`0x${string}`[] | undefined>>;
  setRestakeSkyRewards: React.Dispatch<React.SetStateAction<boolean>>;
  setRestakeSkyAmount: React.Dispatch<React.SetStateAction<bigint>>;
  mutateStakeUsdsAllowance: () => void;
  mutateStakeSkyAllowance: () => void;
  // Analytics params
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  flow: StakeFlow;
  urnIndex: bigint | undefined;
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToWipe: bigint;
  usdsToBorrow: bigint;
  selectedRewardContract: `0x${string}` | undefined;
  wantsToDelegate: boolean | undefined;
  selectedDelegate: `0x${string}` | undefined;
  restakeSkyRewards: boolean;
  restakeSkyAmount: bigint;
  rewardClaimAmounts: Array<{
    contractAddress: `0x${string}`;
    claimBalance: bigint;
    rewardSymbol: string;
  }>;
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
  onNotification,
  onAnalyticsEvent,
  // Analytics params
  needsAllowance,
  shouldUseBatch,
  flow,
  urnIndex,
  skyToLock,
  skyToFree,
  usdsToWipe,
  usdsToBorrow,
  selectedRewardContract,
  wantsToDelegate,
  selectedDelegate,
  restakeSkyRewards,
  restakeSkyAmount,
  rewardClaimAmounts
}: UseStakeTransactionCallbacksParameters) => {
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Tracks which step of a multi-call flow we're on (approve → action)
  const stepRef = useRef(0);

  // Collapse lock/free into a single signed amount (positive = stake, negative = unstake)
  const skyAmount =
    skyToLock > 0n
      ? Number(formatUnits(skyToLock, 18))
      : skyToFree > 0n
        ? -Number(formatUnits(skyToFree, 18))
        : undefined;
  const stakeAction = skyToLock > 0n ? 'stake' : skyToFree > 0n ? 'unstake' : undefined;

  // Collapse borrow/repay into a single signed borrowAmount (positive = borrow, negative = repay)
  const borrowAmount =
    usdsToBorrow > 0n
      ? Number(formatUnits(usdsToBorrow, 18))
      : usdsToWipe > 0n
        ? -Number(formatUnits(usdsToWipe, 18))
        : undefined;
  const borrowAction = usdsToBorrow > 0n ? 'borrow' : usdsToWipe > 0n ? 'repay' : undefined;

  const formattedRestakeAmount =
    restakeSkyRewards && restakeSkyAmount > 0n ? Number(formatUnits(restakeSkyAmount, 18)) : undefined;

  // Build claimedRewards array — moved above stakeData so it can be included
  const claimedRewards = rewardClaimAmounts
    .filter(r => r.claimBalance > 0n)
    .map(r => ({
      tokenSymbol: r.rewardSymbol,
      amount: Number(formatUnits(r.claimBalance, 18)),
      rewardContractAddress: r.contractAddress
    }));
  const claimAction =
    claimedRewards.length === 0
      ? undefined
      : claimedRewards.length === 1
        ? restakeSkyRewards
          ? 'claimAndRestake'
          : 'claim'
        : restakeSkyRewards
          ? 'claimAllAndRestake'
          : 'claimAll';

  // Single source of truth for all stake analytics data
  const stakeData: Record<string, unknown> = {
    module: 'stake',
    assetSymbol: 'SKY',
    borrowSymbol: 'USDS',
    urnIndex: urnIndex !== undefined ? Number(urnIndex) : undefined,
    selectedRewardContract,
    selectedRewardSymbol,
    isDelegating: !!wantsToDelegate && !!selectedDelegate,
    isBatchTx: shouldUseBatch,
    ...(skyAmount != null && { amount: skyAmount, stakeAction }),
    ...(borrowAmount != null && { borrowAmount, borrowAction }),
    ...(formattedRestakeAmount != null && { restakeSkyAmount: formattedRestakeAmount, restakeSkyRewards }),
    ...(claimAction != null && { claimAction, claimedRewards })
  };

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // Silently swallow — analytics must never break functionality
    }
  };

  const multicallTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = stepRef.current;
        stepRef.current++;
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        mutateStakeSkyAllowance();
        mutateStakeUsdsAllowance();
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? 'approve' : 'multicall',
          flow,
          data: stakeData
        });
      },
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: t`Doing multicall` });
      },
      onSuccess: hash => {
        stepRef.current = 0;
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
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: 'multicall',
          flow,
          txHash: hash,
          data: stakeData
        });
      },
      onError: (error, hash) => {
        stepRef.current = 0;
        //TODO: fix all this copy
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateStakeSkyAllowance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: 'multicall',
          flow,
          txHash: hash,
          data: stakeData
        });
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
      setRestakeSkyRewards,
      needsAllowance,
      shouldUseBatch,
      flow,
      stakeData,
      onAnalyticsEvent
    ]
  );

  const claimTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: claimAction ?? 'claim',
          flow,
          data: stakeData
        });
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
        setRewardContractsToClaim(undefined);
        setRestakeSkyRewards(false);
        setRestakeSkyAmount(0n);
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: claimAction ?? 'claim',
          flow,
          txHash: hash,
          data: stakeData
        });
      },
      onError: (error, hash) => {
        //TODO: Update copy
        handleOnError({
          error,
          hash,
          notificationTitle: t`Claim failed`,
          notificationDescription: t`We could not claim your rewards.`
        });
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: claimAction ?? 'claim',
          flow,
          txHash: hash,
          data: stakeData
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
      setRestakeSkyRewards,
      flow,
      stakeData,
      claimAction,
      onAnalyticsEvent
    ]
  );

  return { multicallTransactionCallbacks, claimTransactionCallbacks, stakeData };
};
