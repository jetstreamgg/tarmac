import { useConnection, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { lseDataSource } from './datasources';

type UseUrnAddressResponse = ReadHook & {
  data?: `0x${string}`;
};

export function useUrnAddress(urnIndex: bigint): UseUrnAddressResponse {
  const chainId = useChainId();
  const { address } = useConnection();

  const dataSource = lseDataSource(chainId, 'getUrn');

  const engineAddress = sealModuleAddress[chainId as keyof typeof sealModuleAddress];

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: engineAddress,
    abi: sealModuleAbi,
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
