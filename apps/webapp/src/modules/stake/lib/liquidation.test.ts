import { describe, expect, it } from 'vitest';
import { isAtRiskOfLiquidation, STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD } from './liquidation';

describe('isAtRiskOfLiquidation', () => {
  it('is false when the vault is undefined', () => {
    expect(isAtRiskOfLiquidation(undefined)).toBe(false);
  });

  it('is false when the vault has zero debt, regardless of proximity', () => {
    expect(isAtRiskOfLiquidation({ debtValue: 0n, liquidationProximityPercentage: 100 })).toBe(false);
  });

  it('is false just below the warning threshold', () => {
    expect(
      isAtRiskOfLiquidation({
        debtValue: 100n,
        liquidationProximityPercentage: STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD - 1
      })
    ).toBe(false);
  });

  it('is true exactly at the warning threshold', () => {
    expect(
      isAtRiskOfLiquidation({
        debtValue: 100n,
        liquidationProximityPercentage: STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD
      })
    ).toBe(true);
  });

  it('is true at 100% proximity (the LIQUIDATION risk tier)', () => {
    expect(isAtRiskOfLiquidation({ debtValue: 100n, liquidationProximityPercentage: 100 })).toBe(true);
  });
});
