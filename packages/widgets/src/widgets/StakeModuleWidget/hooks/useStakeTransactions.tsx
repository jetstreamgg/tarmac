import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useStakeTransactionCallbacks } from './useStakeTransactionCallbacks';
import {
  useBatchStakeMulticall,
  useStakeClaimRewards,
  useStakeMulticall,
  useStakeSkyApprove,
  useStakeUsdsApprove
} from '@jetstreamgg/sky-hooks';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeAction } from '../lib/constants';
import { useAccount } from 'wagmi';

interface UseStakeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  lockAmount: bigint;
  stakeSkyAllowance: bigint | undefined;
  stakeUsdsAllowance: bigint | undefined;
  usdsAmount: bigint;
  calldata: `0x${string}`[];
  allStepsComplete: boolean;
  indexToClaim: bigint | undefined;
  setIndexToClaim: React.Dispatch<React.SetStateAction<bigint | undefined>>;
  rewardContractToClaim: `0x${string}` | undefined;
  setRewardContractToClaim: React.Dispatch<React.SetStateAction<`0x${string}` | undefined>>;
  mutateStakeSkyAllowance: () => void;
  mutateStakeUsdsAllowance: () => void;
}

export const useStakeTransactions = ({
  lockAmount,
  stakeSkyAllowance,
  stakeUsdsAllowance,
  usdsAmount,
  calldata,
  allStepsComplete,
  indexToClaim,
  setIndexToClaim,
  rewardContractToClaim,
  setRewardContractToClaim,
  mutateStakeSkyAllowance,
  mutateStakeUsdsAllowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStakeTransactionsParameters) => {
  const { address } = useAccount();
  const { widgetState } = useContext(WidgetContext);
  const {
    approveSkyTransactionCallbacks,
    approveUsdsTransactionCallbacks,
    multicallTransactionCallbacks,
    claimTransactionCallbacks
  } = useStakeTransactionCallbacks({
    lockAmount,
    usdsAmount,
    setIndexToClaim,
    setRewardContractToClaim,
    mutateStakeSkyAllowance,
    mutateStakeUsdsAllowance,
    retryPrepareMulticall: () => multicall.retryPrepare(),
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const lockSkyApprove = useStakeSkyApprove({
    amount: lockAmount,
    enabled: widgetState.action === StakeAction.APPROVE && stakeSkyAllowance !== undefined,
    ...approveSkyTransactionCallbacks
  });

  const repayUsdsApprove = useStakeUsdsApprove({
    amount: usdsAmount,
    enabled: widgetState.action === StakeAction.APPROVE && stakeUsdsAllowance !== undefined,
    ...approveUsdsTransactionCallbacks
  });

  const multicall = useStakeMulticall({
    calldata,
    enabled: widgetState.action === StakeAction.MULTICALL && !!allStepsComplete,
    ...multicallTransactionCallbacks
  });

  const batchMulticall = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
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

  return { lockSkyApprove, repayUsdsApprove, multicall, batchMulticall, claimRewards };
};
