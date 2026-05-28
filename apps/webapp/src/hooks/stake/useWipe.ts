import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookParams, StakeWriteHookReturnType } from './stakeModule';
import { encodeFunctionData } from 'viem';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useWipe({
  gas,
  amount,
  index,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: StakeWriteHookParams & {
  amount: bigint | undefined;
  index: bigint;
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();

  const enabled = !!address && isConnected && activeTabEnabled && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'wipe',
    args: [address!, index, amount!],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    !!address && !!amount
      ? encodeFunctionData({
          abi: stakeModuleAbi,
          functionName: 'wipe',
          args: [address, index, amount]
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
