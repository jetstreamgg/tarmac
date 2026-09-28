import { useConnection, useChainId } from 'wagmi';
import { ZERO_ADDRESS } from '../constants';
import { UseTokenAllowanceResponse, useTokenAllowance } from '../tokens/useTokenAllowance';

/** A per-chain address table, the shape of every `*Address` in `../generated`. */
export type ChainAddressMap = Record<number, `0x${string}`>;

/**
 * The connected wallet's allowance of `token` for `spender` on the current
 * chain — the read every "does this action still need an approve?" gate
 * (savings, stUSDS, stake) makes; the module hooks are one-line bindings of
 * their token/spender pair over this.
 */
export function useSpenderAllowance({
  token,
  spender,
  address
}: {
  token: ChainAddressMap;
  spender: ChainAddressMap;
  /** Owner to read for; defaults to the connected wallet. */
  address?: `0x${string}`;
}): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: token[chainId],
    owner: acct,
    spender: spender[chainId]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
