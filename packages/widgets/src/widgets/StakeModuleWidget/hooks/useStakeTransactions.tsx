import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useStakeTransactionCallbacks } from './useStakeTransactionCallbacks';
import { useBatchStakeMulticall, useStakeClaimRewards } from '@jetstreamgg/sky-hooks';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeAction } from '../lib/constants';
import { useAccount } from 'wagmi';

interface UseStakeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  lockAmount: bigint;
  usdsAmount: bigint;
  calldata: `0x${string}`[];
  allStepsComplete: boolean;
  indexToClaim: bigint | undefined;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  rewardContractToClaim: `0x${string}` | undefined;
  shouldUseBatch: boolean;
  setRewardContractToClaim: React.Dispatch<React.SetStateAction<`0x${string}` | undefined>>;
  mutateStakeSkyAllowance: () => void;
  mutateStakeUsdsAllowance: () => void;
}

export const useStakeTransactions = ({
  lockAmount,
  usdsAmount,
  calldata,
  allStepsComplete,
  indexToClaim,
  setIndexToClaim,
  rewardContractToClaim,
  shouldUseBatch,
  setRewardContractToClaim,
  mutateStakeSkyAllowance,
  mutateStakeUsdsAllowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStakeTransactionsParameters) => {
  const { address } = useAccount();
  const { widgetState } = useContext(WidgetContext);
  const { multicallTransactionCallbacks, claimTransactionCallbacks } = useStakeTransactionCallbacks({
    lockAmount,
    setIndexToClaim,
    setRewardContractToClaim,
    mutateStakeSkyAllowance,
    mutateStakeUsdsAllowance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
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
    rewardContract: rewardContractToClaim,
    to: address,
    enabled: indexToClaim !== undefined && !!rewardContractToClaim && !!address,
    ...claimTransactionCallbacks
  });

  return { batchMulticall, claimRewards };
};
