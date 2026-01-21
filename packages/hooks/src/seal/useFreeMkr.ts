import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { WriteHookParams } from '../hooks';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { getSaFreeMkrCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useFreeMkr({
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  index,
  amount
}: WriteHookParams & {
  index: bigint;
  amount: bigint | undefined;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address: connectedAddress } = useConnection();

  const enabled = isConnected && !!connectedAddress && activeTabEnabled && !!amount && amount !== 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'free',
    // TODO should enable passing in a valid "to" which could be a different address
    args: [connectedAddress!, index, connectedAddress!, amount!],
    chainId: chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    connectedAddress && amount
      ? getSaFreeMkrCalldata({
          ownerAddress: connectedAddress,
          urnIndex: index,
          toAddress: connectedAddress,
          amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
