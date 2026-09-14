import { useMorphoVaultMarketApiData } from '../morpho/useMorphoVaultMarketApiData';
import type { MorphoVaultRateData } from '../morpho/useMorphoVaultRateApiData';
import type { ReadHook } from '../hooks';
import { useSparkVaultApiData } from './spark/useSparkVaultApiData';
import type { VaultProvider } from './types';

/**
 * One allocation bucket in the provider-neutral normalized shape.
 * Provider-optional (Morpho exposes richer market allocations via its own
 * Morpho-specific hook; Spark fills this when its payload carries allocations).
 */
export type NormalizedVaultAllocation = {
  /** Human-readable label for the allocation bucket */
  name: string;
  /** Allocated assets in the smallest asset unit */
  assets: bigint;
  /** Allocated assets in USD, when the source provides it */
  assetsUsd?: number;
  /** Share of total assets (0–1), when computable */
  allocationPercent?: number;
};

/**
 * One point in a provider-neutral TVL/rate history series.
 *
 * Field names/units intentionally match the Morpho chart point
 * (`MorphoVaultChartDataPoint`) so the shared parse hook
 * (`useParseVaultChartData`) and `Chart` component consume either
 * provider's series untouched.
 */
export type NormalizedVaultHistoryPoint = {
  /** Unix timestamp in seconds */
  blockTimestamp: number;
  /** Total assets (TVL) at that point, in the smallest asset unit */
  amount: bigint;
  /** Total assets at that point in USD */
  amountUsd: number;
  /** Net APY at that point, as a decimal (e.g. 0.05 = 5%) */
  apy?: number;
};

/**
 * Provider-neutral normalized market-data contract consumed across providers.
 *
 * Every field is optional: providers fill what they have and the UI degrades
 * cleanly when a field is absent (e.g. an unset Spark endpoint yields all
 * `undefined`). The Morpho market-data shape is a structural superset, so the
 * Morpho hook's result is assignable here untouched (no Morpho regression).
 *
 * Shape per ADR-0001 / APP-266 issue 04: `{ rate, totalAssets, allocations? }`,
 * plus `totalAssetsUsd`/`liquidity` which existing dispatcher consumers read.
 */
export type NormalizedVaultMarketData = {
  /** Rate data (APY, fees, rewards). Reuses the Morpho rate shape for display parity. */
  rate?: MorphoVaultRateData;
  /** Total assets held by the vault (TVL), in the smallest asset unit */
  totalAssets?: bigint;
  /** Total assets held by the vault in USD */
  totalAssetsUsd?: number;
  /** Vault-level available liquidity (Morpho market API; Spark sums the API's `liquidity[]`) */
  liquidity?: bigint;
  /** Provider-optional deposit cap, in the smallest asset unit (Spark surfaces it via the API) */
  depositCap?: bigint;
  /** Provider-optional allocations breakdown (lit up for Spark in slice 05) */
  allocations?: NormalizedVaultAllocation[];
  /**
   * Provider-optional TVL/rate history series for the metrics chart. Morpho
   * sources its chart from the dedicated `useMorphoVaultChartInfo` hook and
   * leaves this undefined; Spark carries its history here in the single
   * normalized payload.
   */
  history?: NormalizedVaultHistoryPoint[];
};

/** Provider-neutral market-data hook return (normalized). */
export type VaultMarketDataHook = ReadHook & {
  data?: NormalizedVaultMarketData;
};

export type UseVaultMarketDataParams = {
  provider: VaultProvider;
  vaultAddress?: `0x${string}`;
};

/**
 * Provider-neutral dispatcher for vault market data (rate / TVL / allocations).
 *
 * Routes to the provider's data source and returns the normalized shape above.
 * Rules of Hooks forbid calling hooks conditionally, so both provider hooks run
 * every render; the inactive one is handed `vaultAddress: undefined` so its
 * query stays disabled (no wrong-provider fetch) and it returns a clean
 * empty/non-loading state.
 */
export function useVaultMarketData({
  provider,
  vaultAddress
}: UseVaultMarketDataParams): VaultMarketDataHook {
  const morphoData = useMorphoVaultMarketApiData({
    vaultAddress: provider === 'morpho' ? vaultAddress : undefined
  });

  const sparkData = useSparkVaultApiData({
    vaultAddress: provider === 'sky' ? vaultAddress : undefined
  });

  return provider === 'sky' ? sparkData : morphoData;
}
