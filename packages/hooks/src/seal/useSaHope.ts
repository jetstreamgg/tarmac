import { useAccount, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { WriteHookParams } from '../hooks';
import { lsMigratorAddress, sealModuleAbi, sealModuleAddress } from '../generated';
import { getSaHopeCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useSaHope({
  gas,
  enabled: paramEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  index
}: WriteHookParams & {
  index: bigint;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();

  const enabled = !!address && isConnected && paramEnabled;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'hope',
    args: [address!, index, lsMigratorAddress[chainId as keyof typeof lsMigratorAddress]],
    chainId,
    gas,
    enabled,
    onStart,
    onError,
    onSuccess
  });

  const calldata = address
    ? getSaHopeCalldata({
        ownerAddress: address,
        urnIndex: index,
        usrAddress: lsMigratorAddress[chainId as keyof typeof lsMigratorAddress]
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
