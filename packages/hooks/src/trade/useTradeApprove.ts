import { useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';
import { gpv2VaultRelayerAddress } from './constants';

export function useTradeApprove({
  amount,
  tokenAddress,
  enabled = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint | undefined;
  tokenAddress: `0x${string}` | undefined;
}): WriteHook {
  const chainId = useChainId();

  return useApproveToken({
    contractAddress: tokenAddress,
    spender: gpv2VaultRelayerAddress[chainId as keyof typeof gpv2VaultRelayerAddress],
    amount,
    enabled,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
