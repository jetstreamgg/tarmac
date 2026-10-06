import { Vault } from '@/hooks';
import { math } from '@/utils';

// 🔶 BL-12: placeholder until product decides the warning threshold.
// 40 aligns with the HIGH risk tier (RISK_LEVEL_THRESHOLDS) so the banner
// appears exactly when the row's risk meter escalates to High.
export const STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD = 40;

/**
 * Whether an active stake position is at risk of
 * liquidation — has outstanding debt and its liquidation proximity has
 * reached the warning threshold. Includes the LIQUIDATION risk tier itself
 * (not just the lead-up to it): the warning banner is meant to show for any
 * at-risk active position, with only the historical *liquidated* state (once
 * barked) taking over instead.
 */
export function isAtRiskOfLiquidation(
  vault: Pick<Vault, 'debtValue' | 'liquidationProximityPercentage'> | undefined
): boolean {
  if (!vault) return false;
  if (!vault.debtValue || vault.debtValue <= 0n) return false;
  if (vault.liquidationProximityPercentage === undefined) return false;
  return vault.liquidationProximityPercentage >= STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD;
}

/**
 * Most collateral that can leave the position while its liquidation proximity
 * stays at or under `threshold` percent. The withdraw field errors past that
 * threshold, so this is the bound the error copy may promise (PR #1938
 * review): the bare liquidation-ratio bound sits at 100% proximity and
 * reproduces the error. Proximity is liquidation price over `riskPrice`, so
 * the bound is the collateral that puts the liquidation price at
 * `threshold`% of it, kept under the delayed price the capped-OSM guard
 * enforces. Floored to whole tokens, the precision the copy quotes it at, so
 * the rounded figure never overshoots the bound it names.
 */
export function maxWithdrawWithinRisk({
  collateral,
  debtValue,
  liquidationRatio,
  delayedPrice,
  riskPrice,
  threshold
}: {
  collateral: bigint;
  debtValue: bigint;
  liquidationRatio: bigint;
  delayedPrice: bigint;
  riskPrice: bigint;
  threshold: number;
}): bigint {
  const atThreshold = (riskPrice * BigInt(Math.round(threshold * 100))) / 10_000n;
  const price = atThreshold < delayedPrice ? atThreshold : delayedPrice - 1n;
  if (price <= 0n) return 0n;
  const minCollateral = math.minSafeCollateralAmount(debtValue, liquidationRatio, price);
  return collateral > minCollateral ? math.removeDecimalPartOfWad(collateral - minCollateral) : 0n;
}
