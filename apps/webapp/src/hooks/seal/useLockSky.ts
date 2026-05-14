import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { WriteHookParams } from '../hooks';
import { useSaNgtAllowance } from './useSaAllowance';
import { encodeFunctionData } from 'viem';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useLockSky({
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  index,
  amount,
  ref = 0
}: WriteHookParams & {
  index: bigint;
  amount: bigint | undefined;
  ref?: number;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();
  const { data: allowance } = useSaNgtAllowance();

  const enabled =
    !!address &&
    isConnected &&
    activeTabEnabled &&
    !!address &&
    !!amount &&
    amount !== 0n &&
    !!allowance &&
    allowance >= amount;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'lockSky',
    args: [address!, index, amount!, ref],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    address && amount
      ? encodeFunctionData({
          abi: sealModuleAbi,
          functionName: 'lockSky',
          args: [address, index, amount, ref]
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
