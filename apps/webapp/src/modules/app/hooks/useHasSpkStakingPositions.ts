import { useMemo } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { useStakeHistory, lsSkySpkRewardAddress, TransactionTypeEnum } from '@jetstreamgg/sky-hooks';
import { isMainnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

/**
 * Hook to check if the connected user has any staking positions with SPK as the reward token.
 * Uses the stake history to find any positions that currently have SPK reward selected.
 */
export const useHasSpkStakingPositions = () => {
  const { address, isConnected } = useConnection();
  const currentChainId = useChainId();
  const stakingChainId = isMainnetId(currentChainId) ? currentChainId : chainIdMap.mainnet;

  const { data: stakeHistory, isLoading } = useStakeHistory({});

  const spkRewardAddress = lsSkySpkRewardAddress[stakingChainId as keyof typeof lsSkySpkRewardAddress];

  const hasSpkPositions = useMemo(() => {
    if (!stakeHistory || !spkRewardAddress || !isConnected || !address) {
      return false;
    }

    // Get the most recent reward selection for each urn index
    const rewardSelections = stakeHistory.filter(
      (item): item is typeof item & { rewardContract: string; urnIndex: number } =>
        item.type === TransactionTypeEnum.STAKE_SELECT_REWARD &&
        'rewardContract' in item &&
        'urnIndex' in item
    );

    // Group by urn index and get the most recent selection for each
    const latestRewardByUrn = new Map<number, string>();

    // stakeHistory is already sorted by blockTimestamp descending,
    // so the first occurrence of each urnIndex is the most recent
    for (const selection of rewardSelections) {
      if (!latestRewardByUrn.has(selection.urnIndex)) {
        latestRewardByUrn.set(selection.urnIndex, selection.rewardContract);
      }
    }

    // Check if any position currently has SPK reward selected
    for (const [, rewardContract] of latestRewardByUrn) {
      if (rewardContract.toLowerCase() === spkRewardAddress.toLowerCase()) {
        return true;
      }
    }

    return false;
  }, [stakeHistory, spkRewardAddress, isConnected, address]);

  return {
    hasSpkPositions,
    isLoading,
    isReady: !isLoading
  };
};
