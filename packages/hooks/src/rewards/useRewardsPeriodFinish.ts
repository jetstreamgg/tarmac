import { usdsSkyRewardAbi } from '../generated';
import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS } from '../constants';

type UseRewardsPeriodFinishResponse = ReadHook & {
  data: bigint | undefined;
};

export function useRewardsPeriodFinish({
  contractAddress,
  chainId
}: {
  contractAddress: Address;
  chainId: number;
}): UseRewardsPeriodFinishResponse {
  const dataSource: DataSource = {
    onChain: true,
    href: getEtherscanLink(chainId, contractAddress, 'address'),
    title: 'StakingRewards Contract. periodFinish',
    trustLevel: TRUST_LEVELS[0]
  };

  const { data, isLoading, error, refetch } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'periodFinish'
  });

  return {
    data,
    isLoading: isLoading,
    error,
    mutate: refetch,
    dataSources: [dataSource]
  };
}
