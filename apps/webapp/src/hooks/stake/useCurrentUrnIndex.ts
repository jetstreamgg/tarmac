import { useConnection, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { stakeDataSource } from './datasources';

type UseCurrentUrnIndexResponse = ReadHook & {
  data: bigint | undefined;
};

export function useCurrentUrnIndex(): UseCurrentUrnIndexResponse {
  const chainId = useChainId();
  const { address } = useConnection();

  const dataSource = stakeDataSource(chainId, 'usrAmts');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
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
