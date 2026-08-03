import { Vault } from '@/hooks';

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
