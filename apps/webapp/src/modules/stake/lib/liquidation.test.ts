import { describe, expect, it } from 'vitest';
import { math } from '@/utils';
import {
  isAtRiskOfLiquidation,
  maxWithdrawWithinRisk,
  STAKE_LIQUIDATION_WARNING_PROXIMITY_THRESHOLD
} from './liquidation';

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

describe('maxWithdrawWithinRisk', () => {
  const WAD = 10n ** 18n;
  const RAY = 10n ** 27n;
  const mat = (125n * RAY) / 100n;
  const price = (608n * WAD) / 10_000n; // 0.0608
  const args = {
    collateral: 3_000_000n * WAD,
    debtValue: 30_000n * WAD,
    liquidationRatio: mat,
    delayedPrice: price,
    riskPrice: price,
    threshold: 80
  };

  it('quotes the withdraw that lands exactly on the proximity threshold', () => {
    const max = maxWithdrawWithinRisk(args);
    const ink = args.collateral - max;
    const liquidationPrice = math.liquidationPrice(ink, args.debtValue, mat);
    // Proximity is liquidation price over the risk price: 80% here, which the
    // field still accepts; the bare bound (100%) does not.
    expect(Number((liquidationPrice * 10_000n) / price) / 100).toBeCloseTo(80, 1);
    expect(max).toBeLessThan(args.collateral - math.minSafeCollateralAmount(args.debtValue, mat, price));
  });

  it('keeps the liquidation price under the delayed price when the market runs far above it', () => {
    const max = maxWithdrawWithinRisk({ ...args, riskPrice: price * 2n });
    const liquidationPrice = math.liquidationPrice(args.collateral - max, args.debtValue, mat);
    expect(liquidationPrice).toBeLessThan(price);
  });

  it('floors the bound to whole tokens so the quoted figure stays inside it', () => {
    const max = maxWithdrawWithinRisk(args);
    expect(max % WAD).toBe(0n);
    // One more token over the bound would cross the threshold.
    const over = math.liquidationPrice(args.collateral - max - WAD, args.debtValue, mat);
    const at = math.liquidationPrice(args.collateral - max, args.debtValue, mat);
    expect(at).toBeLessThanOrEqual((price * 80n) / 100n);
    expect(over).toBeGreaterThan((price * 80n) / 100n);
  });

  it('is 0 when the position is already past the threshold', () => {
    expect(maxWithdrawWithinRisk({ ...args, collateral: 700_000n * WAD })).toBe(0n);
  });
});
