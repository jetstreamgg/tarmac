import {
  RewardContract,
  useBatchClaimAllRewards,
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

interface UseRewardsTransactionsParameters extends Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'
> {
  selectedRewardContract: RewardContract | undefined;
  referralCode: number | undefined;
  amount: bigint;
  rewardsBalance: bigint | undefined;
  needsAllowance: boolean;
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
  needsAllowance,
  shouldUseBatch,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance,
  setClaimAmount
}: UseRewardsTransactionsParameters) => {
  const chainId = useChainId();
  const {
    supplyTransactionCallbacks,
    withdrawTransactionCallbacks,
    claimTransactionCallbacks,
    claimAllTransactionCallbacks
  } = useRewardsTransactionCallbacks({
    selectedRewardContract,
    amount,
    rewardsBalance,
    needsAllowance,
    shouldUseBatch,
    mutateAllowance,
    mutateTokenBalance,
    mutateRewardsBalance,
    mutateUserSuppliedBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    onAnalyticsEvent,
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

  // Claim all
  const claimAll = useBatchClaimAllRewards(claimAllTransactionCallbacks);

  return { batchSupply, withdraw, claim, claimAll };
};
