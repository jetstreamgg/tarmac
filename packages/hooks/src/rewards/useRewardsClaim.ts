import { usdsSkyRewardAbi } from '../generated';
import { useAccount, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useRewardsClaim({
  contractAddress,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  contractAddress: `0x${string}`;
}): WriteHook {
  const chainId = useChainId();
  const { address } = useAccount();

  return useWriteContractFlow({
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'getReward',
    chainId,
    enabled: !!address,
    gas,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
