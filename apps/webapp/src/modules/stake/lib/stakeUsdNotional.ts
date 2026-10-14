import { formatUnits } from 'viem';

/** An 18-decimal token amount as a JS float (USDS at parity IS its USD figure). */
export function wadToFloat(wad: bigint): number {
  return Number(formatUnits(wad, 18));
}

/** USD value of an 18-decimal token amount at `price` USD per token. */
export function wadToUsd(wad: bigint, price: number): number {
  return wadToFloat(wad) * price;
}

/**
 * The `priceOf` every stake surface derives from `usePrices()`: a missing
 * symbol prices at 0 rather than NaN, so an unknown reward token drops out of
 * a sum instead of poisoning it.
 */
export function priceOfFromPrices(prices: Record<string, { price: string }> | undefined) {
  return (symbol: string) => parseFloat(prices?.[symbol]?.price ?? '0');
}

/** USD value of a claimable-rewards list, each reward valued through `priceOf`. */
export function sumRewardsUsd(
  rewards: readonly { claimBalance: bigint; rewardSymbol: string }[],
  priceOf: (symbol: string) => number
): number {
  return rewards.reduce(
    (total, reward) => total + wadToUsd(reward.claimBalance, priceOf(reward.rewardSymbol)),
    0
  );
}

/**
 * USD notional of a staged stake action for the enhanced-screening threshold
 * (APP-517): the moved SKY leg at spot plus the moved USDS leg at $1,
 * magnitudes regardless of direction. A non-zero SKY leg with no price
 * available returns `undefined` — UNKNOWN, which the screening treats as
 * above-threshold. Shared by the open and manage launch hooks so the rule
 * (and its fail-closed semantics) lives once.
 */
export function stakeUsdNotional(
  skyWad: bigint,
  usdsWad: bigint,
  skyPriceString?: string
): number | undefined {
  const usdsFloat = wadToFloat(usdsWad);
  if (skyWad === 0n) return usdsFloat;
  if (!skyPriceString) return undefined;
  return wadToUsd(skyWad, parseFloat(skyPriceString)) + usdsFloat;
}
