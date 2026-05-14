import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookParams, StakeWriteHookReturnType } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { ZERO_ADDRESS } from '../constants';
import { getStakeGetRewardCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useClaimRewards({
  index,
  rewardContract,
  to,
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: StakeWriteHookParams & {
  index: bigint | undefined;
  rewardContract: `0x${string}` | undefined;
  to: `0x${string}` | undefined;
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();

  const enabled =
    isConnected &&
    activeTabEnabled &&
    !!address &&
    !!rewardContract &&
    !!to &&
    to !== ZERO_ADDRESS &&
    index !== undefined;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress] as `0x${string}`,
    abi: stakeModuleAbi,
    functionName: 'getReward',
    args: [address!, index!, rewardContract!, to!],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata = enabled
    ? getStakeGetRewardCalldata({
        ownerAddress: address,
        urnIndex: index,
        rewardContractAddress: rewardContract,
        toAddress: to
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
