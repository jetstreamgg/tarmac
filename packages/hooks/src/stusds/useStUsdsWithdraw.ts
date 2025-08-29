import { useAccount, useBlockNumber, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useStUsdsData } from './useStUsdsData';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { stUsdsAddress } from '../generated';
import { useReadStUsdsImplementation, stUsdsImplementationAbi } from './useReadStUsdsImplementation';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { Abi } from 'viem';

export function useStUsdsWithdraw({
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  max = false
}: WriteHookParams & {
  amount: bigint;
  max?: boolean;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: stUsdsData } = useStUsdsData();

  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ chainId, watch: true });

  // When 'max' is true, use the maxWithdraw balance to avoid leaving dust
  const { data: maxWithdraw, queryKey } = useReadStUsdsImplementation({
    functionName: 'maxWithdraw',
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: chainId as keyof typeof useReadStUsdsImplementation,
    query: {
      enabled: !!max && !!connectedAddress
    }
  });

  // Since the `watch` property of wagmi hooks is deprecated, we need to manually invalidate the query
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber, queryClient, queryKey]);

  // Apply liquidity buffer when using max withdrawal to prevent tx failures
  const withdrawAmount = (() => {
    if (!max) return amount;

    const maxWithdrawAmount = (maxWithdraw as bigint) ?? amount;

    // If we have the buffered value from stUsdsData, use that directly
    if (stUsdsData?.userMaxWithdrawBuffered) {
      return stUsdsData.userMaxWithdrawBuffered;
    }

    return maxWithdrawAmount;
  })();

  // Only enabled if user has a balance in stUSDS which is GTE the amount to withdraw
  const enabled =
    isConnected &&
    !!stUsdsData &&
    !!stUsdsData?.userMaxWithdrawBuffered &&
    stUsdsData.userMaxWithdrawBuffered > 0n &&
    stUsdsData.userMaxWithdrawBuffered >= withdrawAmount &&
    withdrawAmount > 0n &&
    activeTabEnabled &&
    !!connectedAddress;

  return useWriteContractFlow({
    address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    abi: stUsdsImplementationAbi as Abi,
    functionName: 'withdraw',
    args: [withdrawAmount, connectedAddress!, connectedAddress!] as const,
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
