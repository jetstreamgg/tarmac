import { useAccount, useChainId } from 'wagmi';
import { usdsAddress, stUsdsAddress, curveStUsdsUsdsPoolAddress } from '../../generated';
import { ReadHook } from '../../hooks';
import { useTokenAllowance } from '../../tokens/useTokenAllowance';
import { ZERO_ADDRESS, TENDERLY_CHAIN_ID } from '../../constants';
import { isTestnetId } from '@jetstreamgg/sky-utils';

export type CurveAllowanceHookResponse = ReadHook & {
  data?: bigint;
  /** Whether the current allowance is sufficient for the given amount */
  hasAllowance: boolean;
  mutate: () => void;
};

export type CurveAllowanceParams = {
  /** Which token to check allowance for */
  token: 'USDS' | 'stUSDS';
  /** Amount to check against (optional, for hasAllowance calculation) */
  amount?: bigint;
  /** Address to check allowance for (defaults to connected wallet) */
  address?: `0x${string}`;
};

/**
 * Hook to check token allowance for the Curve USDS/stUSDS pool.
 *
 * @param params - Allowance check parameters
 * @returns Allowance data and helper flags
 */
export function useCurveAllowance(params: CurveAllowanceParams): CurveAllowanceHookResponse {
  const { token, amount = 0n, address } = params;

  const { address: connectedAddress } = useAccount();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  // Determine which token contract to check
  const tokenAddress =
    token === 'USDS'
      ? usdsAddress[chainId as keyof typeof usdsAddress]
      : stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  // Spender is the Curve pool
  const spender = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: tokenAddress,
    owner: acct,
    spender
  });

  const hasAllowance =
    useAllowanceResponse.data !== undefined && amount > 0n ? useAllowanceResponse.data >= amount : false;

  return {
    ...useAllowanceResponse,
    hasAllowance,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources],
    mutate: useAllowanceResponse.mutate || (() => {})
  };
}
