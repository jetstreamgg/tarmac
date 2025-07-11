import { useAccount, useChainId } from 'wagmi';
import { WriteHookParams } from '../hooks';
import { SaWriteHookReturnType } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { getSaFreeSkyCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useFreeSky({
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
  const { isConnected, address: connectedAddress } = useAccount();

  const enabled = isConnected && !!connectedAddress && activeTabEnabled && !!amount && amount !== 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'freeSky',
    args: [connectedAddress!, index, connectedAddress!, amount!],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    connectedAddress && amount
      ? getSaFreeSkyCalldata({
          ownerAddress: connectedAddress,
          urnIndex: index,
          toAddress: connectedAddress,
          amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
