import { ReadHook } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { useChainId, useReadContract } from 'wagmi';
import { lseDataSource } from './datasources';

type UseCurrentUrnSelectedRewardContractResponse = ReadHook & {
  data: `0x${string}` | undefined;
};

export function useUrnSelectedRewardContract({
  urn
}: {
  urn: `0x${string}`;
}): UseCurrentUrnSelectedRewardContractResponse {
  const chainId = useChainId();
  const dataSource = lseDataSource(chainId, 'urnFarms');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'urnFarms',
    args: [urn || ZERO_ADDRESS],
    scopeKey: `urnFarms-${urn}-${chainId}`,
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
