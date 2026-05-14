import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookReturnType } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { getStakeSelectDelegateCalldata } from './calldata';

export function useSelectStakeVoteDelegate({
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
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { address } = useConnection();

  const enabled = !!address && activeTabEnabled && !!voteDelegate;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
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
    ? getStakeSelectDelegateCalldata({
        ownerAddress: address,
        urnIndex: index,
        delegateAddress: voteDelegate
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
