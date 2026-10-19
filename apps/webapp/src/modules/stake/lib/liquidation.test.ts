import { describe, expect, it } from 'vitest';
import { math } from '@/utils';
import {
  isAtRiskOfLiquidation,
  maxWithdrawWithinRisk,
  repayToWithdraw,
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

describe('repayToWithdraw', () => {
  const WAD = 10n ** 18n;
  const RAY = 10n ** 27n;
  const CENT = 10n ** 16n;
  const mat = (125n * RAY) / 100n;
  const price = (25n * WAD) / 1000n; // 0.025
  const risk = {
    collateral: 1_440_010n * WAD,
    debtValue: 30_000_870_000_000_000_000_000n, // 30,000.87
    liquidationRatio: mat,
    delayedPrice: price,
    riskPrice: price,
    threshold: 80
  };

  it('is the least cent repay that unblocks the withdraw', () => {
    const withdraw = 9n * WAD;
    expect(maxWithdrawWithinRisk(risk)).toBeLessThan(withdraw);
    const repay = repayToWithdraw({ ...risk, withdraw })!;
    expect(repay % CENT).toBe(0n);
    expect(maxWithdrawWithinRisk({ ...risk, debtValue: risk.debtValue - repay })).toBeGreaterThanOrEqual(
      withdraw
    );
    expect(maxWithdrawWithinRisk({ ...risk, debtValue: risk.debtValue - repay + CENT })).toBeLessThan(
      withdraw
    );
  });

  it('is zero when the withdraw already fits', () => {
    expect(repayToWithdraw({ ...risk, debtValue: 1_000n * WAD, withdraw: 9n * WAD })).toBe(0n);
  });

  it('asks for the whole debt when only a debt-free position can withdraw it all', () => {
    expect(repayToWithdraw({ ...risk, withdraw: risk.collateral })).toBe(
      ((risk.debtValue + CENT - 1n) / CENT) * CENT
    );
  });

  it('is undefined past the collateral', () => {
    expect(repayToWithdraw({ ...risk, withdraw: risk.collateral + WAD })).toBeUndefined();
  });

  it('holds the least-repay property across random positions', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return BigInt(seed % n);
    };
    for (let i = 0; i < 2000; i++) {
      const p = {
        ...risk,
        collateral: (1_000_000n + rand(9_000_000)) * WAD,
        debtValue: (20_000n + rand(80_000)) * WAD + rand(100) * CENT + rand(1000)
      };
      const withdraw = (1n + rand(Number(p.collateral / WAD))) * WAD;
      const repay = repayToWithdraw({ ...p, withdraw });
      if (repay === undefined) continue;
      const after = (r: bigint) =>
        maxWithdrawWithinRisk({ ...p, debtValue: p.debtValue > r ? p.debtValue - r : 0n });
      expect(after(repay)).toBeGreaterThanOrEqual(withdraw);
      if (repay > 0n) expect(after(repay - CENT)).toBeLessThan(withdraw);
    }
  });
});
