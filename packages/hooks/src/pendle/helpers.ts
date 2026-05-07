import { PendleMarketConfig } from './pendle';

/** Whether a market has matured (expiry timestamp <= now). */
export function isMarketMatured(expiry: number): boolean {
  return Math.floor(Date.now() / 1000) >= expiry;
}

/** Seconds remaining until market expiry; clamped at 0. */
export function secondsToExpiry(market: PendleMarketConfig): number {
  return Math.max(0, market.expiry - Math.floor(Date.now() / 1000));
}

/**
 * Display name for a Pendle aggregator. Pendle's API returns the route
 * source in SCREAMING_SNAKE_CASE (e.g. "KYBERSWAP"); we render it with
 * canonical brand casing wherever the aggregator badge surfaces (the
 * SupplyWithdraw overview and the matured-redeem overview both use this).
 * Unknown values pass through unchanged so a future aggregator addition
 * still renders something sensible.
 */
export function formatPendleAggregatorName(raw: string): string {
  const known: Record<string, string> = {
    KYBERSWAP: 'KyberSwap',
    ODOS: 'Odos',
    OKX: 'OKX',
    PARASWAP: 'Paraswap'
  };
  return known[raw.toUpperCase()] ?? raw;
}
