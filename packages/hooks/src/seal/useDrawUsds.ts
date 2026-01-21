import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookParams, SaWriteHookReturnType } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { ZERO_ADDRESS } from '../constants';
import { getSaDrawCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useDrawUsds({
  index,
  to,
  gas,
  amount,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: SaWriteHookParams & {
  index: bigint;
  to: `0x${string}`;
  amount: bigint | undefined;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();

  const enabled =
    !!address && isConnected && activeTabEnabled && !!to && to !== ZERO_ADDRESS && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress] as `0x${string}`,
    abi: sealModuleAbi,
    functionName: 'draw',
    args: [address!, index, to, amount!],
    chainId: chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    !!address && !!to && !!amount
      ? getSaDrawCalldata({
          ownerAddress: address,
          urnIndex: index,
          toAddress: to,
          amount: amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
