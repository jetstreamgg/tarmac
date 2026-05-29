import { ReadHook } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { useChainId, useReadContract } from 'wagmi';
import { lseDataSource } from './datasources';

type UseCurrentUrnSelectedVoteDelegateResponse = ReadHook & {
  data: `0x${string}` | undefined;
};

export function useUrnSelectedVoteDelegate({
  urn
}: {
  urn: `0x${string}`;
}): UseCurrentUrnSelectedVoteDelegateResponse {
  const chainId = useChainId();
  const dataSource = lseDataSource(chainId, 'urnVoteDelegates');

  const { data, isLoading, error, refetch } = useReadContract({
    chainId,
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'urnVoteDelegates',
    args: [urn || ZERO_ADDRESS],
    scopeKey: `urnVoteDelegates-${urn}-${chainId}`,
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
