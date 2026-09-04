import { formatUnits } from 'viem';

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
  const usdsFloat = Number(formatUnits(usdsWad, 18));
  if (skyWad === 0n) return usdsFloat;
  if (!skyPriceString) return undefined;
  return Number(formatUnits(skyWad, 18)) * parseFloat(skyPriceString) + usdsFloat;
}
