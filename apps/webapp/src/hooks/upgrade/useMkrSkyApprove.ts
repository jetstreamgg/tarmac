import { useChainId } from 'wagmi';
import { mkrSkyAddress } from '../generated';

import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';

export function useMkrSkyApprove({
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
    spender: mkrSkyAddress[chainId as keyof typeof mkrSkyAddress],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
