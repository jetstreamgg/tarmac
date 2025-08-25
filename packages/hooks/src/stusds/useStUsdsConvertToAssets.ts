import { useChainId } from 'wagmi';
import { useReadStUsds } from '../generated';
import { ReadHook } from '../hooks';
import { useMemo } from 'react';

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
  } = useReadStUsds({
    functionName: 'convertToAssets',
    args: [shares],
    chainId: chainId as keyof typeof useReadStUsds,
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
