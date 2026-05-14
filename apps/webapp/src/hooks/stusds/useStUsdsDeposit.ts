import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { stUsdsAddress, stUsdsImplementationAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { Abi } from 'viem';

export function useStUsdsDeposit({
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  referral = 0
}: WriteHookParams & {
  amount: bigint;
  referral?: number;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  // Only enabled if basic conditions are met (allowance check handled by widget)
  const enabled = isConnected && !!amount && amount !== 0n && activeTabEnabled && !!connectedAddress;

  return useWriteContractFlow({
    address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    abi: stUsdsImplementationAbi as Abi,
    functionName: 'deposit',
    args: connectedAddress
      ? ([amount, connectedAddress, ...(referral > 0 ? [referral] : [])] as const)
      : undefined,
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
