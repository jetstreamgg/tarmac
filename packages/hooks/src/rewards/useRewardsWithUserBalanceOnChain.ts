import { useReadContracts } from 'wagmi';
import { usdsSkyRewardAbi, usdsSpkRewardAbi, cleRewardAbi } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { useMemo } from 'react';

type RewardWithUserBalance = {
  rewardContract: `0x${string}`;
  userHasBalance: boolean;
};

// Map contract addresses to their ABIs
const CONTRACT_ABI_MAP: Record<string, any> = {
  // usdsSkyReward
  '0x0650CAF159C5A49f711e8169D4336ECB9b950275': usdsSkyRewardAbi,
  '0x0650caf159c5a49f711e8169d4336ecb9b950275': usdsSkyRewardAbi, // lowercase version

  // usdsSpkReward
  '0x173e314C7635B45322cd8Cb14f44b312e079F3af': usdsSpkRewardAbi,
  '0x173e314c7635b45322cd8cb14f44b312e079f3af': usdsSpkRewardAbi, // lowercase version

  // cleReward
  '0x10ab606B067C9C461d8893c47C7512472E19e2Ce': cleRewardAbi,
  '0x10ab606b067c9c461d8893c47c7512472e19e2ce': cleRewardAbi // lowercase version
};

export const useRewardsWithUserBalanceOnChain = ({
  contractAddresses,
  address,
  chainId
}: {
  contractAddresses: `0x${string}`[];
  address?: `0x${string}`;
  chainId: number;
}): ReadHook & { data?: RewardWithUserBalance[] } => {
  // Build contracts array for batch reading
  const contracts = useMemo(() => {
    if (!address) return [];

    const contractCalls: any[] = [];
    contractAddresses.forEach(contractAddress => {
      const abi = CONTRACT_ABI_MAP[contractAddress.toLowerCase()];
      if (abi) {
        // Add balanceOf call
        contractCalls.push({
          address: contractAddress,
          abi,
          functionName: 'balanceOf',
          args: [address],
          chainId
        });
        // Add earned call
        contractCalls.push({
          address: contractAddress,
          abi,
          functionName: 'earned',
          args: [address],
          chainId
        });
      }
    });
    return contractCalls;
  }, [contractAddresses, address, chainId]);

  // Execute all contract reads in a single batch
  const {
    data: results,
    isLoading,
    error
  } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0
    }
  });

  // Process results into the expected format
  const data = useMemo(() => {
    if (!address || !results) return undefined;

    return contractAddresses.map((contractAddress, index) => {
      const balanceIndex = index * 2;
      const earnedIndex = index * 2 + 1;

      const stakedBalance = results[balanceIndex]?.result as bigint | undefined;
      const earnedRewards = results[earnedIndex]?.result as bigint | undefined;

      const hasBalance = Boolean(
        (stakedBalance && stakedBalance > 0n) || (earnedRewards && earnedRewards > 0n)
      );

      return {
        rewardContract: contractAddress,
        userHasBalance: hasBalance
      };
    });
  }, [contractAddresses, results, address]);

  return {
    data,
    isLoading: !data && isLoading,
    error: (error as Error) || null,
    mutate: () => {
      // Since we're using wagmi's useReadContracts, refetch is handled automatically
      // This is a no-op for compatibility with the existing interface
    },
    dataSources: [
      {
        title: 'Reward contracts',
        href: '',
        onChain: true,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
      }
    ]
  };
};
