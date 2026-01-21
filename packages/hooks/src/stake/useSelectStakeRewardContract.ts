import { useConnection, useChainId } from 'wagmi';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { StakeWriteHookReturnType } from './stakeModule';
import { getStakeSelectRewardContractCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useSelectStakeRewardContract({
  index,
  rewardContract,
  ref = 0,
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: WriteHookParams & {
  index: bigint;
  rewardContract: `0x${string}`;
  ref?: number;
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { address } = useConnection();

  const enabled = !!address && activeTabEnabled && !!rewardContract;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'selectFarm',
    args: [address!, index, rewardContract, ref],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata = address
    ? getStakeSelectRewardContractCalldata({
        ownerAddress: address,
        urnIndex: index,
        rewardContractAddress: rewardContract,
        refCode: ref
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
