import { useConnection, useChainId } from 'wagmi';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { SaWriteHookReturnType } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { getSaOpenCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useOpenUrn({
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: WriteHookParams): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected } = useConnection();

  const { data: urnIndexData, isLoading: isLoadingCurrentUrn, error: errorCurrentUrn } = useCurrentUrnIndex();
  const enabled = isConnected && activeTabEnabled && urnIndexData !== undefined && !isLoadingCurrentUrn;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
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

  const calldata = urnIndexData ? getSaOpenCalldata({ urnIndex: urnIndexData }) : undefined;

  return { ...writeContractFlowData, error: writeContractFlowData.error || errorCurrentUrn, calldata };
}
