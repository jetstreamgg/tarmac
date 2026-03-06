import { useQuery, useQueries } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, VAULT_V2_HISTORICAL_QUERY, VAULT_V2_HISTORICAL_HOURLY_QUERY } from './constants';

/**
 * Raw API response type for Morpho V2 vault historical data.
 */
type MorphoVaultHistoricalApiResponse = {
  data: {
    vaultV2ByAddress: {
      historicalState: {
        totalAssets: Array<{ x: number; y: string }>;
        avgNetApy: Array<{ x: number; y: number }>;
      };
    } | null;
  };
};

/**
 * Parsed chart data point for Morpho vault.
 */
export type MorphoVaultChartDataPoint = {
  /** Unix timestamp in seconds */
  blockTimestamp: number;
  /** Total assets in the vault (bigint) */
  amount: bigint;
  /** Average net APY as a decimal (e.g., 0.05 for 5%) */
  apy?: number;
};

/**
 * Transform raw API response to parsed chart data.
 */
function transformMorphoChartData(
  totalAssets: Array<{ x: number; y: string }>,
  avgNetApy: Array<{ x: number; y: number }>
): MorphoVaultChartDataPoint[] {
  // Create a map of timestamp to APY for easy lookup
  const apyMap = new Map<number, number>();
  avgNetApy.forEach(item => {
    apyMap.set(item.x, item.y);
  });

  return totalAssets.map(item => ({
    blockTimestamp: item.x,
    amount: BigInt(item.y),
    apy: apyMap.get(item.x)
  }));
}

/**
 * Fetch historical chart data for a Morpho V2 vault.
 */
async function fetchMorphoVaultChartInfo(
  vaultAddress: string,
  chainId: number,
  useHourlyInterval?: boolean
): Promise<MorphoVaultChartDataPoint[]> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: useHourlyInterval ? VAULT_V2_HISTORICAL_HOURLY_QUERY : VAULT_V2_HISTORICAL_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId,
        endTimestamp: Math.floor(Date.now() / 1000)
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultHistoricalApiResponse = await response.json();

  if (!result.data.vaultV2ByAddress) {
    return [];
  }

  const { totalAssets, avgNetApy } = result.data.vaultV2ByAddress.historicalState;
  return transformMorphoChartData(totalAssets, avgNetApy);
}

export type MorphoVaultChartInfoHook = ReadHook & {
  data?: MorphoVaultChartDataPoint[];
};

/**
 * Hook for fetching historical chart data for a Morpho V2 vault.
 *
 * Returns daily data points with total assets and average net APY.
 *
 * @param vaultAddress - The Morpho V2 vault contract address
 */
export function useMorphoVaultChartInfo({
  vaultAddress,
  useHourlyInterval
}: {
  vaultAddress: `0x${string}`;
  useHourlyInterval?: boolean;
}): MorphoVaultChartInfoHook {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? mainnet.id : currentChainId;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-chart', vaultAddress, chainId, useHourlyInterval],
    queryFn: () => fetchMorphoVaultChartInfo(vaultAddress, chainId, useHourlyInterval),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Morpho API',
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}

export type MorphoVaultMultipleChartInfoHook = ReadHook & {
  data?: MorphoVaultChartDataPoint[][];
};

/**
 * Hook for fetching historical chart data for multiple Morpho V2 vaults.
 *
 * Fetches all vaults in parallel and returns an array of chart data per vault,
 * preserving the same order as the input addresses.
 *
 * @param vaultAddresses - Array of Morpho V2 vault contract addresses
 */
export function useMorphoVaultMultipleChartInfo({
  vaultAddresses,
  useHourlyInterval
}: {
  vaultAddresses: `0x${string}`[];
  useHourlyInterval?: boolean;
}): MorphoVaultMultipleChartInfoHook {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? mainnet.id : currentChainId;

  const results = useQueries({
    queries: vaultAddresses.map(addr => ({
      queryKey: ['morpho-vault-chart', addr, chainId, useHourlyInterval] as const,
      queryFn: () => fetchMorphoVaultChartInfo(addr, chainId, useHourlyInterval),
      enabled: vaultAddresses.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000 // 10 minutes
    }))
  });

  const data = results.every(r => r.data !== undefined) ? results.map(r => r.data!) : undefined;
  const isLoading = results.some(r => r.isLoading);
  const error = results.find(r => r.error)?.error ?? null;

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate: () => Promise.all(results.map(r => r.refetch())).then(() => {}),
    dataSources: [
      {
        title: 'Morpho API',
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
