import { formatUnits, parseUnits } from 'viem';
import { PENDLE_MARKETS } from './constants';
import type {
  AllPendleUserAssetsData,
  PendleMarketConfig,
  PendleMarketStats,
  PendleMarketUserAsset
} from './pendle';

const EMPTY_DATA: AllPendleUserAssetsData = { total: 0n, totalUsd: 0, markets: [] };
const SECONDS_PER_YEAR = 365.25 * 86400;

/**
 * Mark-to-market discount: PT trades below the underlying by the time-value of
 * the locked-in yield. Pendle's impliedApy is derived from the same relation,
 * so reversing it gives the PT spot price for free. Returns 1 (face value)
 * at or past maturity, or whenever impliedApy is unavailable — graceful
 * fallback for the loading and error paths.
 */
export function ptDiscount(impliedApy: number | undefined, expirySec: number, nowSec: number): number {
  if (impliedApy === undefined || !Number.isFinite(impliedApy)) return 1;
  const secondsToMaturity = expirySec - nowSec;
  if (secondsToMaturity <= 0) return 1;
  const yearsToMaturity = secondsToMaturity / SECONDS_PER_YEAR;
  return Math.pow(1 + impliedApy, -yearsToMaturity);
}

export type ComputePendleAssetValuationsInput = {
  ptBalances: Record<`0x${string}`, bigint> | undefined;
  usdsPrice: number;
  sUsdsPrice: number;
  marketsApi: Partial<Record<`0x${string}`, PendleMarketStats>> | undefined;
  nowSec: number;
};

export function computePendleAssetValuations(
  input: ComputePendleAssetValuationsInput,
  marketConfigs: readonly PendleMarketConfig[] = PENDLE_MARKETS
): AllPendleUserAssetsData {
  if (!input.ptBalances) return EMPTY_DATA;

  const markets: PendleMarketUserAsset[] = [];
  let total = 0n;
  let totalUsd = 0;

  for (const market of marketConfigs) {
    const ptBalance = input.ptBalances[market.marketAddress] || 0n;
    if (ptBalance <= 0n) continue;

    const formatted = formatUnits(ptBalance, market.underlyingDecimals);
    const normalized = parseUnits(formatted, 18);

    const underlyingSpot =
      market.usdsEquivalence === 'pegged'
        ? input.usdsPrice
        : market.usdsEquivalence === 'sUSDS'
          ? input.sUsdsPrice
          : 0;

    const stats = input.marketsApi?.[market.marketAddress];
    const discount = ptDiscount(stats?.impliedApy, market.expiry, input.nowSec);
    const valuationUsd = underlyingSpot > 0 ? parseFloat(formatted) * underlyingSpot * discount : 0;

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
}
