import { useChainId } from 'wagmi';
import { usdsAddress } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';
import { sUsdsAddress } from './useReadSavingsUsds';

export function useSavingsApprove({
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

  const contractAddress = usdsAddress[chainId as keyof typeof usdsAddress];

  return useApproveToken({
    contractAddress,
    spender: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
