import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useStakeTransactionCallbacks } from './useStakeTransactionCallbacks';
import {
  useBatchStakeClaimAllRewards,
  useBatchStakeMulticall,
  useStakeClaimRewards
} from '@jetstreamgg/sky-hooks';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeAction, StakeFlow } from '../lib/constants';
import { useConnection } from 'wagmi';

interface UseStakeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  lockAmount: bigint;
  usdsAmount: bigint;
  calldata: `0x${string}`[];
  allStepsComplete: boolean;
  indexToClaim: bigint | undefined;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  rewardContractsToClaim: `0x${string}`[] | undefined;
  shouldUseBatch: boolean;
  setRewardContractsToClaim: React.Dispatch<React.SetStateAction<`0x${string}`[] | undefined>>;
  setRestakeSkyRewards: React.Dispatch<React.SetStateAction<boolean>>;
  setRestakeSkyAmount: React.Dispatch<React.SetStateAction<bigint>>;
  mutateStakeSkyAllowance: () => void;
  mutateStakeUsdsAllowance: () => void;
  // Analytics params
  needsAllowance: boolean;
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

export const useStakeTransactions = ({
  lockAmount,
  usdsAmount,
  calldata,
  allStepsComplete,
  indexToClaim,
  setIndexToClaim,
  rewardContractsToClaim,
  shouldUseBatch,
  setRewardContractsToClaim,
  setRestakeSkyRewards,
  setRestakeSkyAmount,
  mutateStakeSkyAllowance,
  mutateStakeUsdsAllowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  needsAllowance,
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
}: UseStakeTransactionsParameters) => {
  const { address } = useConnection();
  const { widgetState } = useContext(WidgetContext);
  const { multicallTransactionCallbacks, claimTransactionCallbacks, stakeData } = useStakeTransactionCallbacks({
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
  });

  const batchMulticall = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
    shouldUseBatch,
    enabled:
      (widgetState.action === StakeAction.MULTICALL || widgetState.action === StakeAction.APPROVE) &&
      !!allStepsComplete,
    ...multicallTransactionCallbacks
  });

  const claimRewards = useStakeClaimRewards({
    index: indexToClaim,
    rewardContract: rewardContractsToClaim?.[0],
    to: address,
    enabled:
      indexToClaim !== undefined &&
      !!rewardContractsToClaim &&
      rewardContractsToClaim.length === 1 &&
      !!address,
    ...claimTransactionCallbacks
  });

  const claimAllRewards = useBatchStakeClaimAllRewards({
    index: indexToClaim,
    // Always use batch transactions for this flow
    shouldUseBatch: true,
    enabled: indexToClaim !== undefined && !!rewardContractsToClaim && rewardContractsToClaim.length > 1,
    ...claimTransactionCallbacks
  });

  return { batchMulticall, claimRewards, claimAllRewards, stakeData };
};
