import { useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useApproveToken } from '../tokens/useApproveToken';
import type { ChainAddressMap } from './useSpenderAllowance';

/**
 * Approve `amount` of `token` for `spender` on the current chain — the write
 * twin of `useSpenderAllowance`; the module approve hooks bind their
 * token/spender pair over this.
 */
export function useSpenderApprove({
  token,
  spender,
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  token: ChainAddressMap;
  spender: ChainAddressMap;
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();

  return useApproveToken({
    contractAddress: token[chainId],
    spender: spender[chainId],
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
