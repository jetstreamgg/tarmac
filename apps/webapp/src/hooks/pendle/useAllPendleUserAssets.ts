import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PENDLE_MARKETS } from './constants';
import { fetchPendleDashboardPositions } from './pendleApiClient';
import {
  AllPendleUserAssetsData,
  AllPendleUserAssetsHook,
  PendleMarketConfig,
  PendleMarketUserAsset
} from './pendle';

const EMPTY_DATA: AllPendleUserAssetsData = { total: 0n, totalUsd: 0, markets: [] };

/**
 * Parse the API's "<chainId>-<marketAddress>" id format and return the
 * lowercased market address (or null if the id is malformed).
 */
function parseMarketAddress(marketId: string): `0x${string}` | null {
  const parts = marketId.split('-');
  if (parts.length !== 2 || !parts[1].startsWith('0x')) return null;
  return parts[1].toLowerCase() as `0x${string}`;
}

/**
 * Hook that aggregates the user's PT balances across every Pendle market we
 * support. Sources its data from Pendle's dashboard API (the same backing data
 * shown on app.pendle.finance/dashboard).
 *
 * Filtering:
 *   - Only positions in markets present in PENDLE_MARKETS are returned.
 *   - Only the `pt` leg is included; `yt`, `lp`, `crossPtPositions` are dropped.
 *   - Only chain 1 (mainnet) positions are considered — our integration adds
 *     only mainnet markets, and Pendle's API does not serve Tenderly.
 *
 * Returns:
 *   - `total`: sum of PT balances normalized to 18 decimals (WAD).
 *     PT decimals match the underlying token's decimals.
 *   - `totalUsd`: sum of per-market `pt.valuation` values from the API.
 *   - `markets`: per-market breakdown with the matched config, raw PT balance,
 *     normalized balance, and USD valuation.
 */
export function useAllPendleUserAssets(): AllPendleUserAssetsHook {
  const { address: userAddress } = useConnection();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendle-user-assets', userAddress?.toLowerCase()],
    enabled: !!userAddress,
    queryFn: async (): Promise<AllPendleUserAssetsData> => {
      if (!userAddress) return EMPTY_DATA;
      const json = await fetchPendleDashboardPositions(userAddress);

      const supported = new Map<string, PendleMarketConfig>();
      PENDLE_MARKETS.forEach(m => supported.set(m.marketAddress.toLowerCase(), m));

      const mainnetEntry = json.positions?.find(p => p.chainId === mainnet.id);
      if (!mainnetEntry) return EMPTY_DATA;

      const markets: PendleMarketUserAsset[] = [];
      let total = 0n;
      let totalUsd = 0;

      for (const pos of mainnetEntry.openPositions || []) {
        const addr = parseMarketAddress(pos.marketId);
        if (!addr) continue;
        const market = supported.get(addr);
        if (!market) continue;

        let ptBalance: bigint;
        try {
          ptBalance = BigInt(pos.pt.balance);
        } catch {
          continue;
        }
        if (ptBalance <= 0n) continue;

        const decimals = market.underlyingDecimals;
        // const normalized = decimals < 18 ? ptBalance * 10n ** BigInt(18 - decimals) : ptBalance;
        const normalized = parseUnits(formatUnits(ptBalance, decimals), 18);
        const valuationUsd = pos.pt.valuation || 0;

        total += normalized;
        totalUsd += valuationUsd;
        markets.push({
          marketAddress: market.marketAddress,
          ptBalance,
          ptBalanceNormalized: normalized,
          valuationUsd
        });
      }
      return { total, totalUsd, markets };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  return {
    isLoading,
    data: data ?? EMPTY_DATA,
    error: error || null,
    mutate: refetch,
    dataSources: [
      {
        title: 'Pendle Dashboard API',
        href: 'https://api-v2.pendle.finance/core/docs',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
