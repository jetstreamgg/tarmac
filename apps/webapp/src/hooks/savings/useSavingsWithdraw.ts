import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useSavingsData } from './useSavingsData';
import {
  useReadSavingsUsds,
  sUsdsAddress,
  sUsdsImplementationAbi,
  useReadSavingsUsdsBalanceOf
} from './useReadSavingsUsds';
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

  // Max redeems the whole share balance rather than withdrawing `maxWithdraw`
  // assets: the share count doesn't accrue, so the call stays the same block to
  // block and burns every share, leaving no dust.
  const { data: shares } = useReadSavingsUsdsBalanceOf({
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: chainId as keyof typeof useReadSavingsUsds,
    query: {
      enabled: !!max && !!connectedAddress
    }
  });

  const enabled =
    isConnected &&
    activeTabEnabled &&
    !!connectedAddress &&
    (max
      ? !!shares && shares > 0n
      : // Only enabled if user has a balance in Savings which is GTE the amount to withdraw
        !!savingsData && savingsData.userSavingsBalance >= amount && amount > 0n);

  return useWriteContractFlow({
    address: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: max ? 'redeem' : 'withdraw',
    args: [max ? (shares ?? 0n) : amount, connectedAddress!, connectedAddress!],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
