import { PendleMarketConfig } from './pendle';

/**
 * Whether a market has matured (expiry timestamp <= now).
 * Pure function — accept `now` as parameter for deterministic tests.
 */
export function isMarketMatured(expiry: number, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  return nowSeconds >= expiry;
}

/**
 * Compute the locally-enforced minimum output (PT or underlying) given the
 * API-quoted output and a slippage tolerance.
 *
 * `slippage` is a decimal (e.g. 0.002 = 0.2%). Floor rounding so we never
 * over-trust the API value.
 */
export function applySlippageToMinOut(amountOut: bigint, slippage: number): bigint {
  if (slippage <= 0) return amountOut;
  const bps = BigInt(Math.round(slippage * 10_000));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

/**
 * Realised APY for an early-withdrawal preview.
 *
 * Given the user's original cost basis (underlying paid for `ptOut` PT tokens at
 * `buyTime`) and the current sell quote (`underlyingOut` for the same ptOut at
 * `sellTime`), return the annualised yield.
 *
 * Returns a decimal (0.04 = 4%). Returns 0 if the user is selling at a loss
 * (underlyingOut < underlyingIn) or if the holding period is too short to
 * annualise meaningfully.
 */
export function computeRealisedApy({
  underlyingIn,
  underlyingOut,
  buyTime,
  sellTime
}: {
  underlyingIn: bigint;
  underlyingOut: bigint;
  buyTime: number;
  sellTime: number;
}): number {
  if (underlyingOut <= underlyingIn) return 0;
  const holdingSeconds = sellTime - buyTime;
  if (holdingSeconds <= 0) return 0;

  const ratio = Number(underlyingOut) / Number(underlyingIn);
  const yearsHeld = holdingSeconds / (365 * 24 * 60 * 60);
  return Math.pow(ratio, 1 / yearsHeld) - 1;
}

/**
 * Format a Pendle APY (decimal 0.0402) as a percentage string ("4.02%").
 */
export function formatPendleApy(apy: number, fractionDigits = 2): string {
  return `${(apy * 100).toFixed(fractionDigits)}%`;
}

/** Seconds remaining until market expiry; clamped at 0. */
export function secondsToExpiry(market: PendleMarketConfig & { expiry: number }, nowSeconds: number = Math.floor(Date.now() / 1000)): number {
  return Math.max(0, market.expiry - nowSeconds);
}
