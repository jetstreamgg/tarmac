import { useReadContract } from 'wagmi';
import { mkrSkyAbi, mkrSkyAddress } from '../generated';
import { useChainId } from 'wagmi';

/**
 * Hook to fetch the current fee from the mkrSky contract
 * The fee is a WAD-scaled fraction (0 to 1e18) that determines the upgrade penalty
 * @param chainIdOverride - Optional chain ID override to force using a specific chain's address (e.g., mainnet address when connected to L2)
 * @returns The current fee value used to calculate the delayed upgrade penalty
 */
export function useMkrSkyFee({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  const chainId = useChainId();

  // Use chainIdOverride if provided, otherwise use the connected chain ID
  const effectiveChainId = chainIdOverride ?? chainId;

  // Get the contract address for the effective chain ID
  const address = mkrSkyAddress[effectiveChainId as keyof typeof mkrSkyAddress];

  // Only enable the query if we have a valid address
  const enabled = Boolean(address && effectiveChainId);

  return useReadContract({
    address,
    abi: mkrSkyAbi,
    functionName: 'fee',
    chainId: effectiveChainId,
    query: {
      enabled,
      // Cache for 1 minute since fee changes are rare (governance controlled)
      staleTime: 60 * 1000,
      refetchInterval: 60 * 1000,
      // Enable refetch on window focus to ensure fee is current
      refetchOnWindowFocus: true
    }
  });
}
