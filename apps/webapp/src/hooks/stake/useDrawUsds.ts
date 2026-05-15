import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookParams, StakeWriteHookReturnType } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { ZERO_ADDRESS } from '../constants';
import { getStakeDrawCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useDrawUsds({
  index,
  to,
  gas,
  amount,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: StakeWriteHookParams & {
  index: bigint;
  to: `0x${string}`;
  amount: bigint | undefined;
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();

  const enabled =
    !!address && isConnected && activeTabEnabled && !!to && to !== ZERO_ADDRESS && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress] as `0x${string}`,
    abi: stakeModuleAbi,
    functionName: 'draw',
    args: [address!, index, to, amount!],
    chainId: chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    !!address && !!to && !!amount
      ? getStakeDrawCalldata({
          ownerAddress: address,
          urnIndex: index,
          toAddress: to,
          amount: amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
