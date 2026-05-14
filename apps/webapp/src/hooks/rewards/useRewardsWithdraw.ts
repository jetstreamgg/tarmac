import { usdsSkyRewardAbi } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useRewardsWithdraw({
  contractAddress,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  amount,
  enabled: paramEnabled
}: WriteHookParams & {
  contractAddress: `0x${string}`;
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();
  const { address } = useConnection();

  const enabled = !!paramEnabled && !!address && address !== ZERO_ADDRESS && amount !== 0n;

  return useWriteContractFlow({
    address: contractAddress,
    abi: usdsSkyRewardAbi, // we should be able to use any rewards contract abi here
    functionName: 'withdraw',
    args: [amount],
    chainId,
    enabled,
    gas,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
