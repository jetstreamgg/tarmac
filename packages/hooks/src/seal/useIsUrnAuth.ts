import { useAccount, useChainId } from 'wagmi';
import { lsMigratorAddress, useReadSealModuleIsUrnAuth } from '../generated';
import { ReadHook, ReadHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { lseDataSource } from './datasources';

export type Response = ReadHook & {
  data?: boolean;
};

export function useIsUrnAuth({
  urnIndex,
  enabled: paramEnabled = true
}: ReadHookParams & {
  urnIndex?: bigint;
}): Response {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  const enabled =
    isConnected && paramEnabled && !!address && address !== ZERO_ADDRESS && urnIndex !== undefined;

  const {
    data: isUrnAuth,
    refetch,
    isLoading,
    error
  } = useReadSealModuleIsUrnAuth({
    args: [
      address || ZERO_ADDRESS,
      urnIndex || 0n,
      lsMigratorAddress[chainId as keyof typeof lsMigratorAddress]
    ],
    query: {
      enabled
      // staleTime: 30_000
    }
  });

  return {
    data: isUrnAuth,
    mutate: refetch,
    isLoading,
    error,
    dataSources: [lseDataSource(chainId, 'isUrnAuth')]
  };
}
