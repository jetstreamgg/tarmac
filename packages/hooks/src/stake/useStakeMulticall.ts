import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Token approvals should be checked and handled outside of this hook,
// since multicall can perform different token supplies
export function useStakeMulticall({
  gas,
  enabled: paramEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  calldata
}: WriteHookParams & { calldata: `0x${string}`[] | undefined }): WriteHook {
  const chainId = useChainId();
  const { isConnected } = useConnection();

  const enabled = isConnected && paramEnabled && !!calldata?.length;

  return useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'multicall',
    args: [calldata!],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
