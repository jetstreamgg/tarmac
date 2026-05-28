import { useChainId } from 'wagmi';
import { daiUsdsAddress } from '../generated';

import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';

export function useDaiUsdsApprove({
  amount,
  tokenAddress,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  tokenAddress: `0x${string}`;
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();

  return useApproveToken({
    contractAddress: tokenAddress,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
