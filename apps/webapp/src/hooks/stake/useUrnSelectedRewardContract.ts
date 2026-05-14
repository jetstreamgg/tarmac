import { ReadHook } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { useChainId, useReadContract } from 'wagmi';
import { stakeDataSource } from './datasources';

type UseCurrentUrnSelectedRewardContractResponse = ReadHook & {
  data: `0x${string}` | undefined;
};

export function useUrnSelectedRewardContract({
  urn
}: {
  urn: `0x${string}`;
}): UseCurrentUrnSelectedRewardContractResponse {
  const chainId = useChainId();
  const dataSource = stakeDataSource(chainId, 'urnFarms');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'urnFarms',
    args: [urn || ZERO_ADDRESS],
    scopeKey: `stake-urnFarms-${urn}-${chainId}`,
    query: {
      enabled: !!urn
    }
  });
  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [dataSource]
  };
}
