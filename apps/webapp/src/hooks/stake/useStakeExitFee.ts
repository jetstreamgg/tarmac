import { useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { stakeDataSource } from './datasources';

type UseStakeExitFeeResponse = ReadHook & {
  data?: bigint;
};

export function useStakeExitFee(): UseStakeExitFeeResponse {
  const chainId = useChainId();

  const dataSource = stakeDataSource(chainId, 'fee');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'fee',
    scopeKey: `stake-module-exit-fee-${chainId}`
  });

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [dataSource]
  };
}
