import { useMemo } from 'react';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { usePrices } from '../prices/usePrices';
import { usePendleUserPtBalances } from './usePendleUserPtBalances';
import { usePendleMarketsApiData } from './usePendleMarketsApiData';
import { computePendleAssetValuations } from './computePendleAssetValuations';
import { AllPendleUserAssetsData, AllPendleUserAssetsHook } from './pendle';
import { useNow } from '../ui/useNow';

/**
 * Aggregates the user's PT balances across every Pendle market we support.
 * Reads balances via PT `balanceOf` and values each position mark-to-market
 * (underlying spot × impliedApy-derived discount), matching Pendle's UI and
 * the rest of the Balances widget. Falls back to face value (discount = 1)
 * when impliedApy is still loading.
 *
 * Returns:
 *   - `total`: sum of PT balances normalized to 18 decimals (WAD).
 *   - `totalUsd`: sum of per-market mark-to-market USD valuations.
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
  const { data: marketsApi } = usePendleMarketsApiData();
  // The valuation discounts by time-to-maturity, so it drifts with the clock;
  // a minute is far finer than the discount moves.
  const nowMs = useNow();

  const data = useMemo<AllPendleUserAssetsData>(
    () =>
      computePendleAssetValuations({
        ptBalances,
        usdsPrice: pricesData?.USDS ? parseFloat(pricesData.USDS.price) : 0,
        sUsdsPrice: pricesData?.sUSDS ? parseFloat(pricesData.sUSDS.price) : 0,
        marketsApi,
        nowSec: Math.floor(nowMs / 1000)
      }),
    [ptBalances, pricesData, marketsApi, nowMs]
  );

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
