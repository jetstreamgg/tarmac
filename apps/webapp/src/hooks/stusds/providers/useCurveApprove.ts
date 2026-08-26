import { useChainId } from 'wagmi';
import { usdsAddress, stUsdsAddress, curveStUsdsUsdsPoolAddress } from '../../generated';
import { WriteHook, WriteHookParams } from '../../hooks';
import { useApproveToken } from '../../tokens/useApproveToken';
import { familyMainnetId } from '@/utils';

export type CurveApproveParams = WriteHookParams & {
  /** Which token to approve */
  token: 'USDS' | 'stUSDS';
  /** Amount to approve */
  amount: bigint;
};

/**
 * Hook to approve token spending for the Curve USDS/stUSDS pool.
 *
 * @param params - Approve parameters including token, amount, and callbacks
 * @returns Write hook for the approval transaction
 */
export function useCurveApprove({
  token,
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: CurveApproveParams): WriteHook {
  const connectedChainId = useChainId();
  const chainId = familyMainnetId(connectedChainId);

  // Determine which token contract to approve
  const tokenAddress =
    token === 'USDS'
      ? usdsAddress[chainId as keyof typeof usdsAddress]
      : stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  // Spender is the Curve pool
  const spender = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];

  return useApproveToken({
    contractAddress: tokenAddress,
    spender,
    amount,
    gas,
    onMutate,
    onError,
    onSuccess,
    onStart
  });
}
