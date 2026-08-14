import { useChainId } from 'wagmi';
import { keepPreviousData } from '@tanstack/react-query';
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
      enabled: !!assets && assets > 0n,
      // The amount re-keys this read on every live-max drift (~15s on a Curve
      // withdraw); without a placeholder each drift drops `data` and pulses
      // `isLoading` for a round trip, greying out Confirm from the review
      // screen and degrading the native rate to the 0n stub mid-refetch.
      placeholderData: keepPreviousData
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
