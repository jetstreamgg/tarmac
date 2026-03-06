import { useQuery, useQueries } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, VAULT_V2_HISTORICAL_QUERY, VAULT_V2_HISTORICAL_HOURLY_QUERY } from './constants';

const HOUR_IN_SECONDS = 3600;
const WEEK_IN_SECONDS = 604800;
const MONTH_IN_SECONDS = 2592000;

export type MorphoVaultHourlyWindow = 'w' | 'm';

/**
 * Raw API response type for Morpho V2 vault historical data.
 */
type MorphoVaultHistoricalApiResponse = {
  data: {
    vaultV2ByAddress: {
      historicalState: {
        totalAssets: Array<{ x: number; y: string }>;
        totalAssetsUsd: Array<{ x: number; y: number }>;
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
  /** Total assets in the vault (bigint in native token decimals) */
  amount: bigint;
  /** Total assets in USD */
  amountUsd: number;
  /** Average net APY as a decimal (e.g., 0.05 for 5%) */
  apy?: number;
};

/**
 * Transform raw API response to parsed chart data.
 */
function transformMorphoChartData(
  totalAssets: Array<{ x: number; y: string }>,
  totalAssetsUsd: Array<{ x: number; y: number }>,
  avgNetApy: Array<{ x: number; y: number }>
): MorphoVaultChartDataPoint[] {
  // Create maps for easy lookup by timestamp
  const apyMap = new Map<number, number>();
  avgNetApy.forEach(item => {
    apyMap.set(item.x, item.y);
  });

  const usdMap = new Map<number, number>();
  totalAssetsUsd.forEach(item => {
    usdMap.set(item.x, item.y);
  });

  return totalAssets.map(item => ({
    blockTimestamp: item.x,
    amount: BigInt(item.y),
    amountUsd: usdMap.get(item.x) ?? 0,
    apy: apyMap.get(item.x)
  }));
}

/**
 * Fetch historical chart data for a Morpho V2 vault.
 */
async function fetchMorphoVaultChartInfo(
  vaultAddress: string,
  chainId: number,
  useHourlyInterval?: boolean,
  hourlyWindow?: MorphoVaultHourlyWindow
): Promise<MorphoVaultChartDataPoint[]> {
  const endTimestamp = Math.floor(Date.now() / 1000);
  // Fetch one extra hour of data to ensure the first point isn't excluded
  // by the parser's independently calculated startTimestamp
  const hourlyStartTimestamp =
    endTimestamp - (hourlyWindow === 'w' ? WEEK_IN_SECONDS : MONTH_IN_SECONDS) - HOUR_IN_SECONDS;

  const variables = useHourlyInterval
    ? {
        address: vaultAddress.toLowerCase(),
        chainId,
        startTimestamp: hourlyStartTimestamp,
        endTimestamp
      }
    : {
        address: vaultAddress.toLowerCase(),
        chainId,
        endTimestamp
      };

  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: useHourlyInterval ? VAULT_V2_HISTORICAL_HOURLY_QUERY : VAULT_V2_HISTORICAL_QUERY,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultHistoricalApiResponse = await response.json();

  if (!result.data.vaultV2ByAddress) {
    return [];
  }

  const { totalAssets, totalAssetsUsd, avgNetApy } = result.data.vaultV2ByAddress.historicalState;
  return transformMorphoChartData(totalAssets, totalAssetsUsd, avgNetApy);
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
  useHourlyInterval,
  hourlyWindow
}: {
  vaultAddress: `0x${string}`;
  useHourlyInterval?: boolean;
  hourlyWindow?: MorphoVaultHourlyWindow;
}): MorphoVaultChartInfoHook {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? mainnet.id : currentChainId;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-chart', vaultAddress, chainId, useHourlyInterval, hourlyWindow],
    queryFn: () => fetchMorphoVaultChartInfo(vaultAddress, chainId, useHourlyInterval, hourlyWindow),
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
  useHourlyInterval,
  hourlyWindow
}: {
  vaultAddresses: `0x${string}`[];
  useHourlyInterval?: boolean;
  hourlyWindow?: MorphoVaultHourlyWindow;
}): MorphoVaultMultipleChartInfoHook {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? mainnet.id : currentChainId;

  const results = useQueries({
    queries: vaultAddresses.map(addr => ({
      queryKey: ['morpho-vault-chart', addr, chainId, useHourlyInterval, hourlyWindow] as const,
      queryFn: () => fetchMorphoVaultChartInfo(addr, chainId, useHourlyInterval, hourlyWindow),
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
