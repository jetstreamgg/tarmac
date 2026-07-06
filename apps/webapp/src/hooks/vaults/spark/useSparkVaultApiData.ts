import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'viem/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../../constants';
import type { NormalizedVaultMarketData, VaultMarketDataHook } from '../useVaultMarketData';
import { SPARK_VAULT_IDENTITY } from './constants';
import { buildSparkSavingsUrl, fetchSparkSavingsCurrent, fetchSparkSavingsHistoric } from './sparkSavingsApi';
import { normalizeSparkCurrentData, normalizeSparkHistoricData } from './normalizeSparkVaultData';

/** Asset decimals fallback when the current payload omits the `asset` descriptor. */
const DEFAULT_ASSET_DECIMALS = 18;

async function fetchSparkVaultData(vaultAddress: string): Promise<NormalizedVaultMarketData | undefined> {
  // Current + historic in parallel. The historic series feeds the metrics chart;
  // a historic outage must not blank the core figures, so swallow its error and
  // fall back to an empty (clean) series while current still propagates.
  const [currentResponse, historicResponse] = await Promise.all([
    fetchSparkSavingsCurrent(SPARK_VAULT_IDENTITY),
    fetchSparkSavingsHistoric(SPARK_VAULT_IDENTITY).catch(() => undefined)
  ]);

  const normalized = normalizeSparkCurrentData(currentResponse, vaultAddress);
  // Historic points carry no asset descriptor; source decimals from current.
  const decimals = currentResponse?.data?.asset?.decimals ?? DEFAULT_ASSET_DECIMALS;
  const history = normalizeSparkHistoricData(historicResponse, decimals);

  if (!normalized) {
    return history.length > 0 ? { history } : undefined;
  }
  return { ...normalized, history };
}

/**
 * Spark vault rate/TVL/liquidity/allocations source, mirroring
 * `useMorphoVaultMarketApiData`. Fetches the live Spark Savings API current
 * endpoint and returns the normalized shape consumed by `useVaultMarketData`,
 * so the dispatcher and all UI consumers stay provider-agnostic.
 *
 * On an API error/empty response the hook returns a clean non-loading state (no
 * crash, no toast) — the error is surfaced only via `error`, which the vault UI
 * does not toast on — and on-chain reads remain the fallback for core figures.
 *
 * @param vaultAddress - The Spark vault contract address (optional; omit to disable)
 */
export function useSparkVaultApiData({
  vaultAddress
}: {
  vaultAddress?: `0x${string}`;
}): VaultMarketDataHook {
  // Spark sUSDT is mainnet-only; pin the chainId so the cache key is stable
  // across network switches (same rationale as the Morpho hooks).
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['spark-vault-market-data', vaultAddress, chainId],
    queryFn: () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }
      return fetchSparkVaultData(vaultAddress);
    },
    enabled: !!vaultAddress,
    staleTime: 30_000,
    gcTime: 60_000
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Spark API',
        href: buildSparkSavingsUrl(SPARK_VAULT_IDENTITY),
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
