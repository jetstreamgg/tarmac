import { useConnection, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { stakeDataSource } from './datasources';

type UseUrnAddressResponse = ReadHook & {
  data?: `0x${string}`;
};

export function useUrnAddress(urnIndex: bigint): UseUrnAddressResponse {
  const chainId = useChainId();
  const { address } = useConnection();

  const dataSource = stakeDataSource(chainId, 'getUrn');

  const engineAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: engineAddress,
    abi: stakeModuleAbi,
    functionName: 'ownerUrns',
    args: [address!, urnIndex],
    scopeKey: `urnAddress-${address}-${urnIndex}-${chainId}-${engineAddress}`,
    query: {
      enabled: !!address
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
