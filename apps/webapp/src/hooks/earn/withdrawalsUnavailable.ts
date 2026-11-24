import type { EarnRiskProfileId } from './types';

/**
 * Products that carry the 100%-utilization withdrawal warnings (stUSDS and the
 * stUSDS-collateralized Risk Capital vaults, per the comms brief). Other
 * vaults keep their regular liquidity wording even when constrained.
 */
const WARNED_PROFILES: ReadonlySet<EarnRiskProfileId> = new Set(['stusds', 'vault-risk-capital']);

/**
 * True when what is left to withdraw is under 0.5% of deposits - Morpho's own
 * "active warning" threshold, and the point where "0% available" / "100%
 * utilization" stop being a rounding stretch. Unknown data never warns.
 */
export function isLiquidityExhausted(
  liquidity: bigint | undefined,
  totalAssets: bigint | undefined
): boolean {
  if (liquidity === undefined || totalAssets === undefined || totalAssets === 0n) return false;
  return liquidity * 200n < totalAssets;
}

/** The warning state for a product row: a warned profile whose liquidity is exhausted. */
export function withdrawalsUnavailableFor(
  profile: EarnRiskProfileId,
  liquidity: bigint | undefined,
  totalAssets: bigint | undefined
): boolean {
  return WARNED_PROFILES.has(profile) && isLiquidityExhausted(liquidity, totalAssets);
}
