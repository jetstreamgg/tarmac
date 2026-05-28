import { usdsSkyRewardAbi } from '../generated';
import { useBlockNumber, useReadContract } from 'wagmi';
import { ZERO_ADDRESS } from '../constants';
import { ReadHook } from '../hooks';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type UseRewardsRewardsBalanceResponse = ReadHook & {
  data: bigint | undefined;
};

export function useRewardsRewardsBalance({
  contractAddress,
  address,
  chainId
}: {
  contractAddress: `0x${string}`;
  address?: `0x${string}`;
  chainId: number;
}): UseRewardsRewardsBalanceResponse {
  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ chainId, watch: true });

  const { data, isLoading, error, refetch, queryKey } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi, // we should be able to use any rewards contract abi here
    functionName: 'earned',
    args: [address || ZERO_ADDRESS],
    query: {
      enabled: !!address && address !== ZERO_ADDRESS
    }
  });

  // Since the `watch` property of wagmi hooks is deprecated, we need to manually invalidate the query
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber]);

  return {
    data,
    isLoading: isLoading,
    error,
    mutate: refetch,
    dataSources: []
  };
}
