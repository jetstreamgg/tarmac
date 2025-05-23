import { useAccount, useChainId } from 'wagmi';
import { StakeWriteHookParams } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { getStakeWipeAllCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useWipeAll({
  index,
  gas,
  enabled: activeTabEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: StakeWriteHookParams & {
  index: bigint;
}) {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();

  const enabled = !!address && isConnected && activeTabEnabled;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'wipeAll',
    args: [address!, index],
    chainId,
    gas,
    enabled,
    onStart,
    onError,
    onSuccess
  });

  const calldata = address ? getStakeWipeAllCalldata({ ownerAddress: address, urnIndex: index }) : undefined;

  return { ...writeContractFlowData, calldata };
}
