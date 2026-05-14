import { useConnection, useChainId } from 'wagmi';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { WriteHookParams } from '../hooks';
import { SaWriteHookReturnType } from './sealModule';
import { getSaSelectRewardContractCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useSelectRewardContract({
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
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { address } = useConnection();

  const enabled = !!address && activeTabEnabled && !!rewardContract;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
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
    ? getSaSelectRewardContractCalldata({
        ownerAddress: address,
        urnIndex: index,
        rewardContractAddress: rewardContract,
        refCode: ref
      })
    : undefined;

  return { ...writeContractFlowData, calldata };
}
