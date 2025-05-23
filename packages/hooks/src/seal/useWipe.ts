import { useAccount, useChainId } from 'wagmi';
import { SaWriteHookParams } from './sealModule';
import { encodeFunctionData } from 'viem';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useWipe({
  gas,
  amount,
  index,
  enabled: activeTabEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: SaWriteHookParams & {
  amount: bigint | undefined;
  index: bigint;
}) {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();

  const enabled = !!address && isConnected && activeTabEnabled && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'wipe',
    args: [address!, index, amount!],
    chainId,
    gas,
    enabled,
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
