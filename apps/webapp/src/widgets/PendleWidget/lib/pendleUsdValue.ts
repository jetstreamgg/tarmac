import { formatUnits } from 'viem';
// Import the type from its source module rather than the '@/hooks' barrel: a
// type-only barrel import can still pull the barrel's runtime side effects
// (posthog-js / react-query global listeners) into unit-test transforms.
import type { PriceData } from '@/hooks/prices/usePrices';
import type { PendleAnalyticsSide } from './pendleAnalyticsData';

// Dollar-pegged tokens valued at face ($1) for flow accounting. These are the
// protocol's unit of account; pricing them via a market feed would make a
// stablecoin deposit look like it isn't $1 (e.g. BaLabs quotes USDS at
// 0.9987), break `amount === amountFrom`, and diverge from how savings /
// rewards / trade emit `amount` as the plain token count. Only genuinely
// non-$1 underlyings (sUSDS) are priced.
const DOLLAR_PEGGED = new Set(['USDS', 'USDC', 'DAI', 'USDT']);

/**
 * Converts a token amount (a decimal number, already `formatUnits`'d) into its
 * USD value for use as the analytics `amount` property on Fixed Yield (Pendle)
 * events.
 *
 * Analytics standard: `amount` is the USD value of the user's non-PT leg
 * (input on BUY, output on SELL/REDEEM). `amountFrom`/`amountTo` in the data
 * blob stay as raw token counts.
 *
 * Pricing precedence:
 *   1. Dollar-pegged stablecoins (USDS/USDC/DAI/USDT) → face value ($1), so
 *      `amount === amountFrom` and stablecoin flows match savings/rewards.
 *   2. Otherwise (sUSDS and any future non-$1 underlying) → BaLabs spot.
 *   3. sUSDS with no spot → on-chain sUSDS→USDS rate (chi, `sUsdsPerShareWad`
 *      = USDS assets per 1 sUSDS share in WAD).
 * Returns `undefined` when none apply, so callers omit `amount` rather than
 * emit a wrong-unit number. sUSDS (yield-bearing, ≠ $1) is the case the
 * inflow/outflow dashboards previously mis-summed as a token count.
 *
 * Total by construction (no throw on valid inputs): `formatUnits` on a bigint,
 * `parseFloat`, and arithmetic don't throw; the `typeof === 'bigint'` guard
 * avoids a BigInt-mixing TypeError. App-level safety still applies — capture
 * goes through `safeCapture` — so a miss degrades to "no amount", never a crash.
 */
export function pendleUsdValue(
  symbol: string,
  amount: number,
  pricesData: Record<string, PriceData> | undefined,
  sUsdsPerShareWad: bigint | undefined
): number | undefined {
  if (!Number.isFinite(amount)) return undefined;

  // 1. Dollar-pegged → face value. The protocol's unit of account is $1; do
  // not apply a market price (avoids microprice noise and keeps amount == the
  // token count, matching the other widgets).
  if (DOLLAR_PEGGED.has(symbol)) return amount;

  // 2. Non-pegged (sUSDS, future underlyings) → BaLabs spot.
  const spot = pricesData?.[symbol]?.price;
  if (spot !== undefined) {
    const price = parseFloat(spot);
    if (Number.isFinite(price)) return amount * price;
  }

  // 3. sUSDS with no spot → on-chain chi rate. Treat a non-bigint or
  // non-positive rate as unavailable (0n surfaces from a failed/empty
  // convertToAssets read; the typeof check also blocks a BigInt-mixing
  // TypeError) so we omit `amount` rather than value the leg at $0.
  if (symbol === 'sUSDS') {
    if (typeof sUsdsPerShareWad !== 'bigint' || sUsdsPerShareWad <= 0n) return undefined;
    const rate = parseFloat(formatUnits(sUsdsPerShareWad, 18));
    return Number.isFinite(rate) && rate > 0 ? amount * rate : undefined;
  }

  return undefined;
}

/**
 * Picks the user's non-PT leg for analytics `amount` valuation: the input on
 * BUY, the output on SELL/REDEEM. The PT side is never the unit of account —
 * we measure the real-money (stablecoin / sUSDS) side, matching how the
 * inflow/outflow dashboards sum `amount` across products.
 *
 * Returns the leg's token symbol and its decimal amount (positive). Callers
 * pass the result to `pendleUsdValue` and apply the in/out sign separately
 * (BUY positive, SELL/REDEEM negative).
 */
export function pendleNonPtLeg(
  side: PendleAnalyticsSide,
  opts: {
    originSymbol: string;
    targetSymbol: string;
    amountInBigint: bigint;
    amountOutBigint: bigint;
    fromDecimals: number;
    toDecimals: number;
  }
): { symbol: string; amount: number } {
  if (side === 'buy') {
    return {
      symbol: opts.originSymbol,
      amount: Number(formatUnits(opts.amountInBigint, opts.fromDecimals))
    };
  }
  // sell / redeem → value the output token the user receives.
  return {
    symbol: opts.targetSymbol,
    amount: Number(formatUnits(opts.amountOutBigint, opts.toDecimals))
  };
}
