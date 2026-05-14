import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookReturnType } from './stakeModule';
import { WriteHookParams } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { getStakeFreeCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useFreeCollateral({
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
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address: connectedAddress } = useConnection();

  const enabled = isConnected && !!connectedAddress && activeTabEnabled && !!amount && amount !== 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'free',
    // Note: this hook only supports freeing collateral to the same address as the owner
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
      ? getStakeFreeCalldata({
          ownerAddress: connectedAddress,
          urnIndex: index,
          toAddress: connectedAddress,
          amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
