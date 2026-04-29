import { useChainId, useConnection } from 'wagmi';
import { useTokenAllowance, UseTokenAllowanceResponse } from '../tokens/useTokenAllowance';
import { ZERO_ADDRESS } from '../constants';
import { PENDLE_ROUTER_V4_ADDRESS } from './constants';

/**
 * Hook for the user's ERC-20 allowance against the Pendle Router.
 *
 * Buy flow needs allowance on the underlying token; Withdraw flow needs
 * allowance on the PT token. Caller passes the relevant token address.
 */
export function usePendleAllowance({
  tokenAddress
}: {
  tokenAddress?: `0x${string}`;
}): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const chainId = useChainId();
  const spender = PENDLE_ROUTER_V4_ADDRESS[chainId];

  return useTokenAllowance({
    chainId,
    contractAddress: tokenAddress,
    owner: connectedAddress || ZERO_ADDRESS,
    spender
  });
}
