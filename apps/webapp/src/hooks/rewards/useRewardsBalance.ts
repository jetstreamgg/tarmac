import { usdsSkyRewardAbi } from '../generated';
import { useReadContract } from 'wagmi';
import { ZERO_ADDRESS } from '../constants';
import { ReadHook } from '../hooks';

type UseRewardsSuppliedBalanceResponse = ReadHook & {
  data: bigint | undefined;
};

export function useRewardsSuppliedBalance({
  contractAddress,
  address,
  chainId
}: {
  contractAddress: `0x${string}`;
  address?: `0x${string}`;
  chainId: number;
}): UseRewardsSuppliedBalanceResponse {
  const { data, isLoading, error, refetch } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi, // we should be able to use any rewards contract abi here
    functionName: 'balanceOf',
    args: [address || ZERO_ADDRESS],
    query: {
      enabled: !!address && address !== ZERO_ADDRESS
    },
    scopeKey: `balance-${address}-${contractAddress}-supplied`
  });

  return {
    data,
    isLoading: isLoading,
    error,
    mutate: refetch,
    dataSources: []
  };
}
