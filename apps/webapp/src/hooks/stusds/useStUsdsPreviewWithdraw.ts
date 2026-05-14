import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useMemo } from 'react';
import { useReadStUsdsImplementation } from './useReadStUsdsImplementation';

export type StUsdsPreviewWithdrawHookResponse = ReadHook & {
  data?: bigint;
};

export function useStUsdsPreviewWithdraw(assets: bigint): StUsdsPreviewWithdrawHookResponse {
  const chainId = useChainId();

  const {
    data: shares,
    isLoading,
    error,
    refetch
  } = useReadStUsdsImplementation({
    functionName: 'previewWithdraw',
    args: [assets],
    chainId: chainId as keyof typeof useReadStUsdsImplementation,
    query: {
      enabled: !!assets && assets > 0n
    }
  });

  const mutate = () => {
    refetch();
  };

  const data = useMemo(() => {
    return shares || 0n;
  }, [shares]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: []
  };
}
