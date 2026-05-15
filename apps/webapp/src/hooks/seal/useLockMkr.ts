import { useConnection, useChainId } from 'wagmi';
import { SaWriteHookReturnType } from './sealModule';
import { WriteHookParams } from '../hooks';
import { useSaMkrAllowance } from './useSaAllowance';
import { sealModuleAbi, sealModuleAddress } from '../generated';
import { getSaLockMkrCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useLockMkr({
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
}): SaWriteHookReturnType {
  const chainId = useChainId();
  const { isConnected, address } = useConnection();
  const { data: allowance } = useSaMkrAllowance();

  const enabled =
    !!address &&
    isConnected &&
    activeTabEnabled &&
    !!amount &&
    amount !== 0n &&
    !!allowance &&
    allowance >= amount;

  const writeContractFlowData = useWriteContractFlow({
    address: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    abi: sealModuleAbi,
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
      ? getSaLockMkrCalldata({ ownerAddress: address, urnIndex: index, amount: amount, refCode: ref })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
