import {
  RewardContract,
  useBatchRewardsSupply,
  useRewardsClaim,
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
  rewardsBalance: bigint | undefined;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateTokenBalance: () => void;
  mutateRewardsBalance: () => void;
  mutateUserSuppliedBalance: () => void;
  setClaimAmount: React.Dispatch<React.SetStateAction<bigint>>;
}

export const useRewardsTransactions = ({
  selectedRewardContract,
  referralCode,
  amount,
  rewardsBalance,
  shouldUseBatch,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance,
  setClaimAmount
}: UseRewardsTransactionsParameters) => {
  const chainId = useChainId();
  const { supplyTransactionCallbacks, withdrawTransactionCallbacks, claimTransactionCallbacks } =
    useRewardsTransactionCallbacks({
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
    });

  const { widgetState } = useContext(WidgetContext);

  const batchSupply = useBatchRewardsSupply({
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    supplyTokenAddress: selectedRewardContract?.supplyToken.address[chainId],
    ref: referralCode,
    amount,
    shouldUseBatch,
    enabled: widgetState.action === RewardsAction.SUPPLY || widgetState.action === RewardsAction.APPROVE,
    ...supplyTransactionCallbacks
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

  return { batchSupply, withdraw, claim };
};
