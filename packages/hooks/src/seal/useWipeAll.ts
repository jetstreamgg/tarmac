import { useAccount, useChainId } from 'wagmi';
import { SaWriteHookParams } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { getSaWipeAllCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useWipeAll({
  index,
  gas,
  enabled: activeTabEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: SaWriteHookParams & {
  index: bigint;
}) {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();

  const enabled = !!address && isConnected && activeTabEnabled;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'wipeAll',
    args: [address!, index],
    chainId,
    gas,
    enabled,
    onStart,
    onError,
    onSuccess
  });

  const calldata = address ? getSaWipeAllCalldata({ ownerAddress: address, urnIndex: index }) : undefined;

  return { ...writeContractFlowData, calldata };
}
