import { useQueries } from '@tanstack/react-query';
import { mainnet } from 'viem/chains';
import { math } from '@jetstreamgg/sky-utils';
import { MORPHO_VAULTS } from './constants';
import { fetchMorphoVaultMarketData } from './useMorphoVaultMarketApiData';

export type MorphoVaultsCombinedTvl = {
  /** Combined TVL across all Morpho vaults in USD */
  totalAssetsUsd: number;
  /** Combined TVL across all vaults scaled to 18 decimals (token units, not USD) */
  totalAssetsScaled: bigint;
  /** Minimum net APY across all vaults */
  minRate: number;
  /** Maximum net APY across all vaults */
  maxRate: number;
  /** Formatted minimum rate string (e.g. "4.20%") */
  formattedMinRate: string;
  /** Formatted maximum rate string (e.g. "6.50%") */
  formattedMaxRate: string;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook that fetches data for all configured Morpho vaults and returns
 * combined stats. Uses the same query keys as useMorphoVaultMarketApiData
 */
export function useMorphoVaultsCombinedTvl(): MorphoVaultsCombinedTvl {
  const results = useQueries({
    queries: MORPHO_VAULTS.map(vault => ({
      queryKey: ['morpho-vault-market-data', vault.vaultAddress[mainnet.id], mainnet.id],
      queryFn: () => fetchMorphoVaultMarketData(vault.vaultAddress[mainnet.id], mainnet.id),
      staleTime: 30_000,
      gcTime: 60_000
    }))
  });

  const totalAssetsUsd = results.reduce((sum, result) => sum + (result.data?.totalAssetsUsd ?? 0), 0);

  // Compute combined TVL in scaled token units (18 decimals)
  const totalAssetsScaled = results.reduce((sum, result, index) => {
    if (!result.data) return sum;
    const vault = MORPHO_VAULTS[index];
    const decimals = math.resolveDecimals(vault.assetToken.decimals, mainnet.id);
    return sum + math.scaleToBaseDecimals(result.data.totalAssets, decimals);
  }, 0n);

  // Compute rate range across all vaults
  const rates = results.map(r => r.data?.rate.netRate).filter((r): r is number => r != null);
  const minRate = rates.length > 0 ? Math.min(...rates) : 0;
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
  const formattedMinRate = `${(minRate * 100).toFixed(2)}%`;
  const formattedMaxRate = `${(maxRate * 100).toFixed(2)}%`;

  const isLoading = results.some(r => r.isLoading);
  const error = results.find(r => r.error)?.error ?? null;

  return { totalAssetsUsd, totalAssetsScaled, minRate, maxRate, formattedMinRate, formattedMaxRate, isLoading, error };
}
