import { useChainId } from 'wagmi';
import { useReadStUsds } from '../generated';
import { ReadHook } from '../hooks';
import { useMemo } from 'react';

export type StUsdsPreviewDepositHookResponse = ReadHook & {
  data?: bigint;
};

export function useStUsdsPreviewDeposit(assets: bigint): StUsdsPreviewDepositHookResponse {
  const chainId = useChainId();

  const {
    data: shares,
    isLoading,
    error,
    refetch
  } = useReadStUsds({
    functionName: 'previewDeposit',
    args: [assets],
    chainId: chainId as keyof typeof useReadStUsds,
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
