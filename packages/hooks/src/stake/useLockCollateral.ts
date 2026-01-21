import { useConnection, useChainId } from 'wagmi';
import { StakeWriteHookReturnType } from './stakeModule';
import { WriteHookParams } from '../hooks';
import { useStakeSkyAllowance } from './useStakeAllowance';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { getStakeLockCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useLockCollateral({
  gas,
  enabled: activeTabEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  index,
  amount,
  ref = 0
}: WriteHookParams & {
  index: bigint;
  amount: bigint | undefined;
  ref?: number;
}): StakeWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();
  const { data: allowance } = useStakeSkyAllowance();

  const enabled =
    !!address &&
    isConnected &&
    activeTabEnabled &&
    !!amount &&
    amount !== 0n &&
    !!allowance &&
    allowance >= amount;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'lock',
    args: [address!, index, amount!, ref],
    chainId,
    gas,
    enabled,
    onMutate,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    address && amount
      ? getStakeLockCalldata({ ownerAddress: address, urnIndex: index, amount: amount, refCode: ref })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
