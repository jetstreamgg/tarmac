import { useMemo } from 'react';
import { formatUnits } from 'viem';
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
 * values them against the USDS price — every market in PENDLE_MARKETS we ship
 * to prod has `usdsEquivalence` set, so USDS price is a sufficient peg. For any
 * non-USDS-equivalent market (dev-only), valuation falls back to 0.
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

    const markets: PendleMarketUserAsset[] = [];
    let total = 0n;
    let totalUsd = 0;

    for (const market of PENDLE_MARKETS) {
      const ptBalance = ptBalances[market.marketAddress] || 0n;
      if (ptBalance <= 0n) continue;

      const decimals = market.underlyingDecimals;
      const normalized =
        decimals < 18
          ? ptBalance * 10n ** BigInt(18 - decimals)
          : decimals > 18
            ? ptBalance / 10n ** BigInt(decimals - 18)
            : ptBalance;

      const valuationUsd =
        market.usdsEquivalence && usdsPrice > 0
          ? parseFloat(formatUnits(normalized, 18)) * usdsPrice
          : 0;

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
