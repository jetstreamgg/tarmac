import { usdsSkyRewardAbi } from '../generated';
import { useReadContracts } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { ReadHook } from '../hooks';

type RewardWithUserBalance = {
  rewardContract: `0x${string}`;
  userHasBalance: boolean;
};

export const useRewardsWithUserBalance = ({
  contractAddresses,
  address,
  chainId
}: {
  contractAddresses: `0x${string}`[];
  address?: `0x${string}`;
  chainId: number;
}): ReadHook & { data?: RewardWithUserBalance[] } => {
  // Build contracts array with both balanceOf and earned calls for each contract
  const contracts = contractAddresses.flatMap(contractAddress => [
    {
      address: contractAddress,
      abi: usdsSkyRewardAbi,
      functionName: 'balanceOf' as const,
      args: [address || ZERO_ADDRESS],
      chainId: chainId as any
    },
    {
      address: contractAddress,
      abi: usdsSkyRewardAbi,
      functionName: 'earned' as const,
      args: [address || ZERO_ADDRESS],
      chainId: chainId as any
    }
  ]);

  const {
    data: results,
    error,
    refetch: mutate,
    isLoading
  } = useReadContracts({
    contracts,
    query: {
      enabled: Boolean(contractAddresses.length && address && address !== ZERO_ADDRESS)
    }
  });

  const data: RewardWithUserBalance[] | undefined = results
    ? contractAddresses.map((contractAddress, index) => {
        // Each contract has 2 results: balanceOf at index*2, earned at index*2+1
        const suppliedBalance = results[index * 2]?.result as bigint | undefined;
        const earnedBalance = results[index * 2 + 1]?.result as bigint | undefined;

        const hasSuppliedBalance = suppliedBalance !== undefined && suppliedBalance > 0n;
        const hasEarnedBalance = earnedBalance !== undefined && earnedBalance > 0n;

        return {
          rewardContract: contractAddress,
          userHasBalance: hasSuppliedBalance || hasEarnedBalance
        };
      })
    : undefined;

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'On-chain data',
        href: '',
        onChain: true,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
};
