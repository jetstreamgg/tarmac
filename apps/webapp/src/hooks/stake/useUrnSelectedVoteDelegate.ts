import { ReadHook } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { useChainId, useReadContract } from 'wagmi';
import { stakeDataSource } from './datasources';

type UseCurrentUrnSelectedVoteDelegateResponse = ReadHook & {
  data: `0x${string}` | undefined;
};

export function useUrnSelectedVoteDelegate({
  urn
}: {
  urn: `0x${string}`;
}): UseCurrentUrnSelectedVoteDelegateResponse {
  const chainId = useChainId();
  const dataSource = stakeDataSource(chainId, 'urnVoteDelegates');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'urnVoteDelegates',
    args: [urn || ZERO_ADDRESS],
    scopeKey: `stake-urnVoteDelegates-${urn}-${chainId}`,
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
