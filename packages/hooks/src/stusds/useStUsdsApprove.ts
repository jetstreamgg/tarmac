import { useChainId } from 'wagmi';
import { usdsAddress, stUsdsAddress } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';

export function useStUsdsApprove({
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
    spender: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
