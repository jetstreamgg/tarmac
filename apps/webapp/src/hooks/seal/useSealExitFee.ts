import { useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { lseDataSource } from './datasources';

type UseSealExitFeeResponse = ReadHook & {
  data?: bigint;
};

export function useSealExitFee(): UseSealExitFeeResponse {
  const chainId = useChainId();

  const dataSource = lseDataSource(chainId, 'fee');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'fee',
    scopeKey: `seal-module-exit-fee-${chainId}`
  });

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [dataSource]
  };
}
