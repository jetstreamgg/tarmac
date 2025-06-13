import { usdsSkyRewardAbi } from '../generated';
import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS } from '../constants';

type UseRewardsTotalSuppliedResponse = ReadHook & {
  data: bigint | undefined;
};

export function useRewardsTotalSupplied({
  contractAddress,
  chainId
}: {
  contractAddress: Address;
  chainId: number;
}): UseRewardsTotalSuppliedResponse {
  const dataSource: DataSource = {
    onChain: true,
    href: getEtherscanLink(chainId, contractAddress, 'address'),
    title: 'StakingRewards Contract. totalSupply',
    trustLevel: TRUST_LEVELS[0]
  };

  const { data, isLoading, error, refetch } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'totalSupply'
  });

  return {
    data,
    isLoading: isLoading,
    error,
    mutate: refetch,
    dataSources: [dataSource]
  };
}
