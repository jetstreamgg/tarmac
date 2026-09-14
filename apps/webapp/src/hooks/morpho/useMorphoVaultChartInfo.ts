import { useQuery } from '@tanstack/react-query';
import { ReadHook } from '../hooks';
import {
  MORPHO_API_CHAIN_ID,
  VAULT_V2_HISTORICAL_QUERY,
  VAULT_V2_HISTORICAL_HOURLY_QUERY,
  morphoDataSource
} from './constants';

import { SECONDS_PER_HOUR } from '@/utils';
import { toReadHook } from '../shared/toReadHook';
import { morphoGraphql } from './morphoGraphql';
const WEEK_IN_SECONDS = 604800;
const MONTH_IN_SECONDS = 2592000;

type MorphoVaultHourlyWindow = 'w' | 'm';

/**
 * Raw API response type for Morpho V2 vault historical data.
 */
type MorphoVaultHistoricalApiResponse = {
  data: {
    vaultV2ByAddress: {
      historicalState: {
        totalAssets: Array<{ x: number; y: string | null }>;
        totalAssetsUsd: Array<{ x: number; y: number | null }>;
        avgNetApy: Array<{ x: number; y: number | null }>;
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
  totalAssets: Array<{ x: number; y: string | null }>,
  totalAssetsUsd: Array<{ x: number; y: number | null }>,
  avgNetApy: Array<{ x: number; y: number | null }>
): MorphoVaultChartDataPoint[] {
  // Create maps for easy lookup by timestamp
  const apyMap = new Map<number, number>();
  avgNetApy.forEach(item => {
    if (item.y !== null) apyMap.set(item.x, item.y);
  });

  const usdMap = new Map<number, number>();
  totalAssetsUsd.forEach(item => {
    if (item.y !== null) usdMap.set(item.x, item.y);
  });

  return totalAssets
    .filter((item): item is { x: number; y: string } => item.y !== null)
    .map(item => ({
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
    endTimestamp - (hourlyWindow === 'w' ? WEEK_IN_SECONDS : MONTH_IN_SECONDS) - SECONDS_PER_HOUR;

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

  const result = await morphoGraphql<MorphoVaultHistoricalApiResponse>(
    useHourlyInterval ? VAULT_V2_HISTORICAL_HOURLY_QUERY : VAULT_V2_HISTORICAL_QUERY,
    variables
  );

  if (!result.data.vaultV2ByAddress) {
    return [];
  }

  const { totalAssets, totalAssetsUsd, avgNetApy } = result.data.vaultV2ByAddress.historicalState;
  return transformMorphoChartData(totalAssets, totalAssetsUsd, avgNetApy);
}

type MorphoVaultChartInfoHook = ReadHook & {
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
  hourlyWindow,
  enabled = true
}: {
  vaultAddress: `0x${string}`;
  useHourlyInterval?: boolean;
  hourlyWindow?: MorphoVaultHourlyWindow;
  /** Skip the fetch when false — e.g. for non-Morpho vaults that must not hit the Morpho API. */
  enabled?: boolean;
}): MorphoVaultChartInfoHook {
  const query = useQuery({
    enabled,
    queryKey: ['morpho-vault-chart', vaultAddress, useHourlyInterval, hourlyWindow],
    queryFn: () =>
      fetchMorphoVaultChartInfo(vaultAddress, MORPHO_API_CHAIN_ID, useHourlyInterval, hourlyWindow),
    staleTime: 30_000, // 30 seconds
    gcTime: 60_000 // 1 minute
  });

  return toReadHook(query, [morphoDataSource()]);
}
