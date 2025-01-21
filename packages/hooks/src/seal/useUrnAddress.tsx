import { useAccount, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { lseDataSource } from './datasources';

type UseUrnAddressResponse = ReadHook & {
  data?: `0x${string}`;
};

export function useUrnAddress(urnIndex: bigint): UseUrnAddressResponse {
  const chainId = useChainId();
  const { address } = useAccount();

  const dataSource = lseDataSource(chainId, 'getUrn');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'ownerUrns',
    args: [address!, urnIndex],
    scopeKey: `urnAddress-${address}-${urnIndex}-${chainId}`,
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
