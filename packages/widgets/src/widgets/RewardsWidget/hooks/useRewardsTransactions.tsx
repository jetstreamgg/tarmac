import {
  RewardContract,
  useApproveToken,
  useBatchRewardsSupply,
  useRewardsClaim,
  useRewardsSupply,
  useRewardsWithdraw
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useContext } from 'react';
import { useChainId } from 'wagmi';
import { RewardsAction } from '../lib/constants';
import { useRewardsTransactionCallbacks } from './useRewardsTransactionCallbacks';

interface UseRewardsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  selectedRewardContract: RewardContract | undefined;
  referralCode: number | undefined;
  amount: bigint;
  allowance: bigint | undefined;
  mutateAllowance: () => void;
  mutateTokenBalance: () => void;
  mutateRewardsBalance: () => void;
  mutateUserSuppliedBalance: () => void;
}

export const useRewardsTransactions = ({
  selectedRewardContract,
  referralCode,
  amount,
  allowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance
}: UseRewardsTransactionsParameters) => {
  const chainId = useChainId();
  const {
    approveTransactionCallbacks,
    supplyTransactionCallbacks,
    withdrawTransactionCallbacks,
    claimTransactionCallbacks
  } = useRewardsTransactionCallbacks({
    selectedRewardContract,
    amount,
    mutateAllowance,
    mutateTokenBalance,
    mutateRewardsBalance,
    mutateUserSuppliedBalance,
    retryPrepareSupply: () => supply.retryPrepare(),
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const { widgetState } = useContext(WidgetContext);

  const supplyParams = {
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    supplyTokenAddress: selectedRewardContract?.supplyToken.address[chainId],
    ref: referralCode,
    amount,
    ...supplyTransactionCallbacks
  };

  // Supply call
  const supply = useRewardsSupply({
    ...supplyParams,
    enabled: widgetState.action === RewardsAction.SUPPLY && allowance !== undefined
  });

  const batchSupply = useBatchRewardsSupply({
    ...supplyParams,
    enabled:
      (widgetState.action === RewardsAction.SUPPLY || widgetState.action === RewardsAction.APPROVE) &&
      allowance !== undefined
  });

  // Approve
  const approve = useApproveToken({
    spender: selectedRewardContract?.contractAddress as `0x${string}`,
    enabled: widgetState.action === RewardsAction.APPROVE && allowance !== undefined,
    amount: amount,
    contractAddress: selectedRewardContract?.supplyToken.address[chainId],
    ...approveTransactionCallbacks
  });

  // Withdraw
  const withdraw = useRewardsWithdraw({
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    enabled: widgetState.action === RewardsAction.WITHDRAW,
    amount: amount,
    ...withdrawTransactionCallbacks
  });

  // Harvest
  const claim = useRewardsClaim({
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    ...claimTransactionCallbacks
  });

  return { approve, supply, batchSupply, withdraw, claim };
};
