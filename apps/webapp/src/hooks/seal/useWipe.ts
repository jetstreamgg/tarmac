import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookParams, SaWriteHookReturnType } from './sealModule';
import { encodeFunctionData } from 'viem';
import { sealModuleAbi, sealModuleAddress } from '../generated';
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
}: SaWriteHookParams & {
  amount: bigint | undefined;
  index: bigint;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();

  const enabled = !!address && isConnected && activeTabEnabled && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
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
          abi: sealModuleAbi,
          functionName: 'wipe',
          args: [address, index, amount]
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
