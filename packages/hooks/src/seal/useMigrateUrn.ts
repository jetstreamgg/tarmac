import { useAccount, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { lsMigratorAbi, lsMigratorAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { ZERO_ADDRESS } from '../constants';

export function useMigrateUrn({
  gas,
  enabled: paramEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  oldIndex,
  newIndex,
  ref = 0
}: WriteHookParams & {
  oldIndex: bigint;
  newIndex: bigint;
  ref?: number;
}): SaWriteHookReturnType {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  const enabled = isConnected && paramEnabled && !!address && address !== ZERO_ADDRESS;

  const writeContractFlowData = useWriteContractFlow({
    address: lsMigratorAddress[chainId as keyof typeof lsMigratorAddress],
    abi: lsMigratorAbi,
    functionName: 'migrate',
    args: [address!, oldIndex, address!, newIndex, ref],
    chainId,
    gas,
    enabled,
    onStart,
    onError,
    onSuccess
  });

  return { ...writeContractFlowData };
}
