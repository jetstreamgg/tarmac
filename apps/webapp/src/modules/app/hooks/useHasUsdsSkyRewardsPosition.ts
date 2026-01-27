import { useMemo } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { useRewardsWithUserBalance, usdsSkyRewardAddress } from '@jetstreamgg/sky-hooks';
import { isMainnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

/**
 * Hook to check if the connected user has any position in the deprecated USDS-SKY rewards.
 * Uses the rewards balance to determine if the user has USDS deposited.
 */
export const useHasUsdsSkyRewardsPosition = () => {
  const { address, isConnected } = useConnection();
  const currentChainId = useChainId();
  const rewardsChainId = isMainnetId(currentChainId) ? currentChainId : chainIdMap.mainnet;

  const usdsSkyAddress = usdsSkyRewardAddress[rewardsChainId as keyof typeof usdsSkyRewardAddress];

  const { data: rewardsWithUserBalance, isLoading } = useRewardsWithUserBalance({
    address,
    chainId: rewardsChainId,
    contractAddresses: usdsSkyAddress ? [usdsSkyAddress] : []
  });

  const hasPosition = useMemo(() => {
    if (!rewardsWithUserBalance || !isConnected || !address) {
      return false;
    }

    // Check if user has balance in the USDS-SKY reward contract
    return rewardsWithUserBalance.some(
      reward =>
        reward.rewardContract.toLowerCase() === usdsSkyAddress?.toLowerCase() &&
        reward.userHasBalance === true
    );
  }, [rewardsWithUserBalance, isConnected, address, usdsSkyAddress]);

  return {
    hasPosition,
    isLoading,
    isReady: !isLoading
  };
};
