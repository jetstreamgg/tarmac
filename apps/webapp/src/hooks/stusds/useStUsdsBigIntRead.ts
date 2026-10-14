import { useChainId } from 'wagmi';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ReadHook } from '../hooks';
import { useReadStUsdsProxy } from './useReadStUsdsProxy';

/**
 * One `uint256` view on the stUSDS proxy (the ERC-4626 previews), in the
 * module's `ReadHook` shape: `mutate` refetches and `data` is `0n` until the
 * read lands. The read is enabled while `assets > 0n`; `query` layers any
 * further react-query option on top.
 */
export function useStUsdsBigIntRead(
  functionName: 'previewDeposit' | 'previewWithdraw',
  assets: bigint,
  query?: { placeholderData?: typeof keepPreviousData }
): ReadHook & { data?: bigint } {
  const chainId = useChainId();

  const {
    data: value,
    isLoading,
    error,
    refetch
  } = useReadStUsdsProxy({
    functionName,
    args: [assets] as const,
    chainId: chainId as keyof typeof useReadStUsdsProxy,
    query: {
      enabled: !!assets && assets > 0n,
      ...query
    }
  });

  const mutate = () => {
    refetch();
  };

  // Both previews return one uint256; the union of function names widens the
  // codegen's inferred return, so narrow it back here.
  const data = useMemo(() => {
    return (value as bigint | undefined) || 0n;
  }, [value]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: []
  };
}
