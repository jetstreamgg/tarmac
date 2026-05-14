import { useConnection, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { lseDataSource } from './datasources';

type UseCurrentUrnIndexResponse = ReadHook & {
  data: bigint | undefined;
};

export function useCurrentUrnIndex(): UseCurrentUrnIndexResponse {
  const chainId = useChainId();
  const { address } = useConnection();

  const dataSource = lseDataSource(chainId, 'usrAmts');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'ownerUrnsCount',
    args: [address!],
    scopeKey: `urnIndex-${address}-${chainId}`,
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
