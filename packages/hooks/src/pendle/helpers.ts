import { PendleMarketConfig } from './pendle';

/** Whether a market has matured (expiry timestamp <= now). */
export function isMarketMatured(expiry: number): boolean {
  return Math.floor(Date.now() / 1000) >= expiry;
}

/** Seconds remaining until market expiry; clamped at 0. */
export function secondsToExpiry(market: PendleMarketConfig): number {
  return Math.max(0, market.expiry - Math.floor(Date.now() / 1000));
}
