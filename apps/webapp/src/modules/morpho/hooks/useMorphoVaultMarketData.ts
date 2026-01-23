import { useMorphoVaultAllocations, useMorphoMarketData } from '@jetstreamgg/sky-hooks';

/**
 * Hook that fetches market data for a Morpho vault.
 * Gets the marketId from the vault's allocations and fetches the market state.
 */
export function useMorphoVaultMarketData({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  // Get the marketId from allocations
  const { data: allocations, isLoading: isAllocationsLoading } = useMorphoVaultAllocations({ vaultAddress });
  const marketId = allocations?.markets[0]?.marketId as `0x${string}` | undefined;

  // Fetch market data using the marketId
  const { data: marketData, isLoading: isMarketLoading } = useMorphoMarketData({ marketId });

  return {
    data: marketData,
    isLoading: isAllocationsLoading || isMarketLoading,
    marketId
  };
}
