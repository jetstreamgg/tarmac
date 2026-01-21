import { useConnection, useChainId } from 'wagmi';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { StakeWriteHookReturnType } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { getStakeOpenCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useOpenUrn({
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: WriteHookParams): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected } = useConnection();

  const { data: urnIndexData, isLoading: isLoadingCurrentUrn, error: errorCurrentUrn } = useCurrentUrnIndex();
  const enabled = isConnected && activeTabEnabled && urnIndexData !== undefined && !isLoadingCurrentUrn;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'open',
    args: [urnIndexData!],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata = urnIndexData ? getStakeOpenCalldata({ urnIndex: urnIndexData }) : undefined;

  return { ...writeContractFlowData, error: writeContractFlowData.error || errorCurrentUrn, calldata };
}
