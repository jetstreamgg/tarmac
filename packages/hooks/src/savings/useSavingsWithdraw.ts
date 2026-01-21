import { useConnection, useBlockNumber, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useSavingsData } from './useSavingsData';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useReadSavingsUsds, sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useSavingsWithdraw({
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
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();
  const { data: savingsData } = useSavingsData();

  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ chainId, watch: true });

  // When 'max' is true, use the maxWithdrawBalance to avoid leaving dust
  const { data: maxWithdraw, queryKey } = useReadSavingsUsds({
    functionName: 'maxWithdraw',
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: chainId as keyof typeof useReadSavingsUsds,
    query: {
      enabled: !!max && !!connectedAddress
    }
  });

  // Since the `watch` property of wagmi hooks is deprecated, we need to manually invalidate the query
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber]);

  const withdrawAmount = max ? (maxWithdraw ?? amount) : amount;

  // Only enabled if user has a balance in Savings which is GTE the amount to withdraw
  const enabled =
    isConnected &&
    !!savingsData &&
    savingsData?.userSavingsBalance > 0n &&
    savingsData?.userSavingsBalance >= withdrawAmount &&
    withdrawAmount > 0n &&
    activeTabEnabled &&
    !!connectedAddress;

  return useWriteContractFlow({
    address: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: 'withdraw',
    args: [withdrawAmount, connectedAddress!, connectedAddress!],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
