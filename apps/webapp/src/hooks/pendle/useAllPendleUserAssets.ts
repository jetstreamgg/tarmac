import { useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { usePrices } from '../prices/usePrices';
import { PENDLE_MARKETS } from './constants';
import { usePendleUserPtBalances } from './usePendleUserPtBalances';
import {
  AllPendleUserAssetsData,
  AllPendleUserAssetsHook,
  PendleMarketUserAsset
} from './pendle';

const EMPTY_DATA: AllPendleUserAssetsData = { total: 0n, totalUsd: 0, markets: [] };

/**
 * Hook that aggregates the user's PT balances across every Pendle market we
 * support. Reads balances on-chain via PT `balanceOf` (matching the widget) and
 * values them against the price implied by each market's `usdsEquivalence`:
 *   - 'pegged' markets use the USDS price
 *   - 'sUSDS'  markets use the sUSDS price
 *   - markets without `usdsEquivalence` (dev-only) fall back to 0.
 *
 * Returns:
 *   - `total`: sum of PT balances normalized to 18 decimals (WAD).
 *   - `totalUsd`: sum of per-market USD valuations.
 *   - `markets`: per-market breakdown with raw and normalized balance + USD.
 */
export function useAllPendleUserAssets(): AllPendleUserAssetsHook {
  const {
    data: ptBalances,
    isLoading: balancesLoading,
    error: balancesError,
    mutate: refetchBalances
  } = usePendleUserPtBalances();
  const { data: pricesData, isLoading: pricesLoading, error: pricesError } = usePrices();

  const data = useMemo<AllPendleUserAssetsData>(() => {
    if (!ptBalances) return EMPTY_DATA;
    const usdsPrice = pricesData?.USDS ? parseFloat(pricesData.USDS.price) : 0;
    const sUsdsPrice = pricesData?.sUSDS ? parseFloat(pricesData.sUSDS.price) : 0;

    const markets: PendleMarketUserAsset[] = [];
    let total = 0n;
    let totalUsd = 0;

    for (const market of PENDLE_MARKETS) {
      const ptBalance = ptBalances[market.marketAddress] || 0n;
      if (ptBalance <= 0n) continue;

      const formatted = formatUnits(ptBalance, market.underlyingDecimals);
      const normalized = parseUnits(formatted, 18);

      const price =
        market.usdsEquivalence === 'pegged'
          ? usdsPrice
          : market.usdsEquivalence === 'sUSDS'
            ? sUsdsPrice
            : 0;
      const valuationUsd = price > 0 ? parseFloat(formatted) * price : 0;

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
  }, [ptBalances, pricesData]);

  return {
    isLoading: balancesLoading || pricesLoading,
    data,
    error: balancesError || pricesError || null,
    mutate: refetchBalances,
    dataSources: [
      {
        title: 'PT contracts',
        href: '',
        onChain: true,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
