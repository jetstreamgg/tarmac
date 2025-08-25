import { useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { sealModuleAddress, mkrAddress, skyAddress, usdsAddress } from '../generated';
import { useApproveToken } from '../tokens/useApproveToken';
import { math } from '@jetstreamgg/sky-utils';

export function useSaMkrApprove({
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();

  const contractAddress = mkrAddress[chainId as keyof typeof mkrAddress];

  return useApproveToken({
    contractAddress,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}

export function useSaNgtApprove({
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();

  const contractAddress = skyAddress[chainId as keyof typeof skyAddress];

  return useApproveToken({
    contractAddress,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}

export function useSaNstApprove({
  amount,
  roundUp = false,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint;
  roundUp?: boolean;
}): WriteHook {
  const chainId = useChainId();

  const contractAddress = usdsAddress[chainId as keyof typeof usdsAddress];

  return useApproveToken({
    contractAddress,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress],
    amount: roundUp && amount > 0n ? math.removeDecimalPartOfWad(amount) + 1000000000000000000n : amount, // round up 1 usds
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
