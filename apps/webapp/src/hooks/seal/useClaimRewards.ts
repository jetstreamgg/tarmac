import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookParams, SaWriteHookReturnType } from './sealModule';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { ZERO_ADDRESS } from '../constants';
import { getSaGetRewardCalldata } from './calldata';
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
}: SaWriteHookParams & {
  index: bigint | undefined;
  rewardContract: `0x${string}` | undefined;
  to: `0x${string}` | undefined;
}): SaWriteHookReturnType {
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
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress] as `0x${string}`,
    abi: sealModuleAbi,
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
    ? getSaGetRewardCalldata({
        ownerAddress: address,
        urnIndex: index,
        rewardContractAddress: rewardContract,
        toAddress: to
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
