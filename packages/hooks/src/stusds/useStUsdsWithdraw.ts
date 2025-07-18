import { useAccount, useBlockNumber, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useStUsdsData } from './useStUsdsData';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useReadStUsds, stUsdsAddress, stUsdsAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useStUsdsWithdraw({
  amount,
  gas,
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
  const { data: maxWithdraw, queryKey } = useReadStUsds({
    functionName: 'maxWithdraw',
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: chainId as keyof typeof useReadStUsds,
    query: {
      enabled: !!max && !!connectedAddress
    }
  });

  // Since the `watch` property of wagmi hooks is deprecated, we need to manually invalidate the query
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber, queryClient, queryKey]);

  const withdrawAmount = max ? (maxWithdraw ?? amount) : amount;

  // Only enabled if user has a balance in stUSDS which is GTE the amount to withdraw
  // Account for precision buffer - subtract 1 wei for comparison
  const userMaxWithdrawForComparison =
    (stUsdsData?.userMaxWithdraw || 0n) > 1n
      ? (stUsdsData?.userMaxWithdraw || 0n) - 1n
      : stUsdsData?.userMaxWithdraw || 0n;

  const enabled =
    isConnected &&
    !!stUsdsData &&
    stUsdsData?.userMaxWithdraw > 0n &&
    userMaxWithdrawForComparison >= withdrawAmount &&
    withdrawAmount > 0n &&
    activeTabEnabled &&
    !!connectedAddress;

  return useWriteContractFlow({
    address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    abi: stUsdsAbi,
    functionName: 'withdraw',
    args: [withdrawAmount, connectedAddress!, connectedAddress!],
    chainId,
    gas,
    enabled,
    onSuccess,
    onError,
    onStart
  });
}
