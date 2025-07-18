import { useAccount, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { stUsdsAddress, stUsdsAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useStUsdsDeposit({
  amount,
  gas,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  referral = 0
}: WriteHookParams & {
  amount: bigint;
  referral?: number;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();

  // Only enabled if basic conditions are met (allowance check handled by widget)
  const enabled = isConnected && !!amount && amount !== 0n && activeTabEnabled && !!connectedAddress;

  // Use separate calls for deposit with and without referral due to TypeScript overload issues
  if (referral && referral > 0) {
    return useWriteContractFlow({
      address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
      abi: stUsdsAbi,
      functionName: 'deposit',
      args: [amount, connectedAddress!, referral] as const,
      chainId,
      gas,
      enabled,
      onSuccess,
      onError,
      onStart
    });
  } else {
    return useWriteContractFlow({
      address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
      abi: stUsdsAbi,
      functionName: 'deposit',
      args: [amount, connectedAddress!] as const,
      chainId,
      gas,
      enabled,
      onSuccess,
      onError,
      onStart
    });
  }
}
