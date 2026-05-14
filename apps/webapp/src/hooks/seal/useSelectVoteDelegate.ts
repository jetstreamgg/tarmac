import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { getSaSelectDelegateCalldata } from './calldata';

export function useSelectVoteDelegate({
  index,
  voteDelegate,
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: WriteHookParams & {
  index: bigint;
  voteDelegate: `0x${string}`;
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { address } = useConnection();

  const enabled = !!address && activeTabEnabled && !!voteDelegate;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
    functionName: 'selectVoteDelegate',
    args: [address!, index, voteDelegate],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata = address
    ? getSaSelectDelegateCalldata({ ownerAddress: address, urnIndex: index, delegateAddress: voteDelegate })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
