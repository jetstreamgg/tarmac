import { useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';
import { PENDLE_ROUTER_V4_ADDRESS } from './constants';

/**
 * Hook for approving an ERC-20 token to the Pendle Router.
 *
 * Buy flow approves the underlying token. Withdraw flow approves the PT token.
 * Caller passes the relevant token address and amount.
 */
export function usePendleApprove({
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
  const spender = PENDLE_ROUTER_V4_ADDRESS[chainId];

  return useApproveToken({
    contractAddress: tokenAddress,
    spender,
    amount,
    enabled,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
