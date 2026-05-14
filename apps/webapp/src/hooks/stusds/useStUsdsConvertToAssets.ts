import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useMemo } from 'react';
import { useReadStUsdsImplementation } from './useReadStUsdsImplementation';

export type StUsdsConvertToAssetsHookResponse = ReadHook & {
  data?: bigint;
};

export function useStUsdsConvertToAssets(shares: bigint): StUsdsConvertToAssetsHookResponse {
  const chainId = useChainId();

  const {
    data: assets,
    isLoading,
    error,
    refetch
  } = useReadStUsdsImplementation({
    functionName: 'convertToAssets',
    args: [shares],
    chainId: chainId as keyof typeof useReadStUsdsImplementation,
    query: {
      enabled: !!shares && shares > 0n
    }
  });

  const mutate = () => {
    refetch();
  };

  const data = useMemo(() => {
    return assets || 0n;
  }, [assets]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: []
  };
}
