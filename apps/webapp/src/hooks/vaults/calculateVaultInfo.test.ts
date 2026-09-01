import { describe, expect, it } from 'vitest';
import { formatUnits, parseUnits } from 'viem';
import { calculateVaultInfo } from './calculateVaultInfo';
import { math, RAD_PRECISION, RAY_PRECISION, WAD_PRECISION } from '@/utils';
import { RISK_LEVEL_THRESHOLDS, RiskLevel } from './vaults.constants';

const computeLiquidationProximity = (
  debtValue: bigint,
  liquidationPrice: bigint,
  marketPrice: bigint,
  collateralValue: bigint,
  delayedPrice: bigint
): number => {
  if (debtValue === 0n) {
    return 0;
  }
  if (liquidationPrice >= delayedPrice) {
    return 100;
  }
  if (liquidationPrice >= marketPrice) {
    return 100;
  }
  if (collateralValue === 0n && debtValue > 0n) {
    return 100;
  }
  if (marketPrice === 0n) {
    return 100;
  }

  const proximityPercentage = Number(((marketPrice - liquidationPrice) * 100n) / marketPrice);
  return 100 - proximityPercentage;
};

const deriveRiskLevel = (liquidationProximityPercentage: number): RiskLevel => {
  return (
    RISK_LEVEL_THRESHOLDS.find(({ threshold }) => liquidationProximityPercentage >= threshold)?.level ||
    RiskLevel.LOW
  );
};

describe('calculateVaultInfo', () => {
  const ONE_RAY = 10n ** BigInt(RAY_PRECISION);

  it('returns derived values when market price data is present', () => {
    const inputs = {
      spot: parseUnits('0.95', RAY_PRECISION),
      rate: parseUnits('1.03', RAY_PRECISION),
      art: parseUnits('10', WAD_PRECISION),
      ink: parseUnits('150', WAD_PRECISION),
      par: ONE_RAY,
      mat: parseUnits('1.10', RAY_PRECISION),
      dust: parseUnits('50', RAD_PRECISION),
      marketPrice: parseUnits('1.35', WAD_PRECISION)
    } as const;

    const result = calculateVaultInfo(inputs);

    const expectedDebtValue = math.debtValue(inputs.art, inputs.rate);
    const expectedDelayedPrice = math.delayedPrice(inputs.par, inputs.spot, inputs.mat);
    const expectedCollateralValue = math.collateralValue(inputs.ink, expectedDelayedPrice);
    const expectedMaxBorrowable = math.daiAvailable(expectedCollateralValue, expectedDebtValue, inputs.mat);
    const expectedLiquidationPrice = math.liquidationPrice(inputs.ink, expectedDebtValue, inputs.mat);
    const collateralValueNoCap = math.collateralValue(inputs.ink, inputs.marketPrice!);
    const maxBorrowableNoCap = math.daiAvailable(collateralValueNoCap, expectedDebtValue, inputs.mat);
    const expectedLiquidationProximityPercentage = computeLiquidationProximity(
      expectedDebtValue,
      expectedLiquidationPrice,
      inputs.marketPrice!,
      expectedCollateralValue,
      expectedDelayedPrice
    );
    const expectedRiskLevel = deriveRiskLevel(expectedLiquidationProximityPercentage);
    const expectedDust = BigInt(formatUnits(inputs.dust, RAD_PRECISION - WAD_PRECISION));

    expect(result.debtValue).toBe(expectedDebtValue);
    expect(result.delayedPrice).toBe(expectedDelayedPrice);
    expect(result.collateralValue).toBe(expectedCollateralValue);
    expect(result.collateralAmount).toBe(inputs.ink);
    expect(result.maxSafeBorrowableAmount).toBe(expectedMaxBorrowable);

    expect(result.maxSafeBorrowableIntAmount).toBeDefined();
    expect(result.maxSafeBorrowableIntAmountNoCap).toBeDefined();

    const maxSafeBorrowableIntAmount = result.maxSafeBorrowableIntAmount!;
    const maxSafeBorrowableIntAmountNoCap = result.maxSafeBorrowableIntAmountNoCap!;

    expect(maxSafeBorrowableIntAmount).toBe(math.removeDecimalPartOfWad(expectedMaxBorrowable));
    expect(result.liquidationPrice).toBe(expectedLiquidationPrice);
    expect(result.collateralizationRatio).toBe(
      math.collateralizationRatio(collateralValueNoCap, expectedDebtValue)
    );
    expect(maxSafeBorrowableIntAmountNoCap).toBe(math.removeDecimalPartOfWad(maxBorrowableNoCap));
    expect(result.maxSafeBorrowableAmount).not.toBe(maxBorrowableNoCap);
    expect(result.liquidationProximityPercentage).toBe(expectedLiquidationProximityPercentage);
    expect(result.riskLevel).toBe(expectedRiskLevel);
    expect(result.dust).toBe(expectedDust);
    expect(maxSafeBorrowableIntAmountNoCap).toBeGreaterThan(maxSafeBorrowableIntAmount);
  });

  it('handles zero debt values and enforces minimum dust unit', () => {
    const inputs = {
      spot: ONE_RAY,
      rate: ONE_RAY,
      art: 0n,
      ink: parseUnits('8', WAD_PRECISION),
      par: ONE_RAY,
      mat: parseUnits('1.10', RAY_PRECISION),
      dust: 0n,
      marketPrice: parseUnits('1', WAD_PRECISION)
    } as const;

    const result = calculateVaultInfo(inputs);

    const expectedDelayedPrice = math.delayedPrice(inputs.par, inputs.spot, inputs.mat);
    const expectedCollateralValue = math.collateralValue(inputs.ink, expectedDelayedPrice);

    expect(result.debtValue).toBe(0n);
    expect(result.liquidationPrice).toBe(0n);
    expect(result.collateralizationRatio).toBe(0n);
    expect(result.collateralValue).toBe(expectedCollateralValue);
    expect(result.liquidationProximityPercentage).toBe(0);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
    expect(result.dust).toBe(1n);

    expect(result.maxSafeBorrowableAmount).toBeDefined();
    expect(result.maxSafeBorrowableIntAmount).toBeDefined();
    expect(result.maxSafeBorrowableIntAmountNoCap).toBeDefined();

    const debtValue = result.debtValue ?? 0n;
    const maxBorrowableAmount = result.maxSafeBorrowableAmount!;
    const maxBorrowableIntAmount = result.maxSafeBorrowableIntAmount!;
    const maxBorrowableIntAmountNoCap = result.maxSafeBorrowableIntAmountNoCap!;
    const collateralValueNoCap = math.collateralValue(inputs.ink, inputs.marketPrice!);
    const maxBorrowableNoCap = math.daiAvailable(collateralValueNoCap, debtValue, inputs.mat);

    expect(maxBorrowableIntAmount).toBe(math.removeDecimalPartOfWad(maxBorrowableAmount));
    expect(maxBorrowableIntAmountNoCap).toBe(math.removeDecimalPartOfWad(maxBorrowableNoCap));
  });

  // A position with liquidationPrice >= delayedPrice is liquidatable right
  // now per the protocol's enforcement price (vat.spot) — a market price
  // sitting comfortably above the liquidation price must not mask that.
  it('flags 100% proximity / LIQUIDATION risk when liquidationPrice >= delayedPrice, regardless of a high market price', () => {
    const inputs = {
      spot: ONE_RAY, // 1.0 ray
      rate: ONE_RAY, // 1.0 ray
      art: parseUnits('100', WAD_PRECISION), // 100 debt units
      ink: parseUnits('100', WAD_PRECISION), // 100 collateral units
      par: ONE_RAY,
      mat: parseUnits('1.2', RAY_PRECISION),
      dust: parseUnits('50', RAD_PRECISION),
      // Far above both liquidationPrice ($1.20) and delayedPrice ($1.20) —
      // the old bug used this to (wrongly) compute a low proximity.
      marketPrice: parseUnits('5', WAD_PRECISION)
    } as const;

    const result = calculateVaultInfo(inputs);

    // Sanity: liquidationPrice and delayedPrice both land on a clean $1.20,
    // so liquidationPrice >= delayedPrice holds (the trigger condition).
    expect(result.delayedPrice).toBe(parseUnits('1.2', WAD_PRECISION));
    expect(result.liquidationPrice).toBe(parseUnits('1.2', WAD_PRECISION));

    expect(result.liquidationProximityPercentage).toBe(100);
    expect(result.riskLevel).toBe(RiskLevel.LIQUIDATION);
  });

  it('computes a low proximity / LOW risk for a healthy position, well clear of both delayed and market price', () => {
    const inputs = {
      spot: ONE_RAY,
      rate: ONE_RAY,
      art: parseUnits('10', WAD_PRECISION), // small debt relative to collateral
      ink: parseUnits('100', WAD_PRECISION),
      par: ONE_RAY,
      mat: parseUnits('1.2', RAY_PRECISION),
      dust: parseUnits('50', RAD_PRECISION),
      marketPrice: parseUnits('2', WAD_PRECISION)
    } as const;

    const result = calculateVaultInfo(inputs);

    // Sanity: liquidationPrice ($0.12) sits well below delayedPrice ($1.20)
    // and marketPrice ($2), so this is a genuinely healthy position.
    expect(result.delayedPrice).toBe(parseUnits('1.2', WAD_PRECISION));
    expect(result.liquidationPrice).toBe(parseUnits('0.12', WAD_PRECISION));

    // proximity = 100 - ((marketPrice - liquidationPrice) * 100 / marketPrice)
    //           = 100 - ((2 - 0.12) * 100 / 2) = 100 - 94 = 6
    expect(result.liquidationProximityPercentage).toBe(6);
    expect(result.liquidationProximityPercentage!).toBeLessThan(25);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('returns 0 proximity / LOW risk when the vault has no debt (art = 0)', () => {
    const inputs = {
      spot: ONE_RAY,
      rate: ONE_RAY,
      art: 0n,
      ink: parseUnits('100', WAD_PRECISION),
      par: ONE_RAY,
      mat: parseUnits('1.2', RAY_PRECISION),
      dust: parseUnits('50', RAD_PRECISION),
      marketPrice: parseUnits('2', WAD_PRECISION)
    } as const;

    const result = calculateVaultInfo(inputs);

    expect(result.debtValue).toBe(0n);
    expect(result.liquidationProximityPercentage).toBe(0);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('falls back to delayedPrice when marketPrice is undefined, with the same result the fix produces when marketPrice is present', () => {
    const inputs = {
      spot: ONE_RAY,
      rate: ONE_RAY,
      art: parseUnits('10', WAD_PRECISION),
      ink: parseUnits('100', WAD_PRECISION),
      par: ONE_RAY,
      mat: parseUnits('1.2', RAY_PRECISION),
      dust: parseUnits('50', RAD_PRECISION)
      // marketPrice intentionally omitted.
    } as const;

    const result = calculateVaultInfo(inputs);

    expect(result.delayedPrice).toBe(parseUnits('1.2', WAD_PRECISION));
    expect(result.liquidationPrice).toBe(parseUnits('0.12', WAD_PRECISION));

    // proximity = 100 - ((delayedPrice - liquidationPrice) * 100 / delayedPrice)
    //           = 100 - ((1.2 - 0.12) * 100 / 1.2) = 100 - 90 = 10
    expect(result.liquidationProximityPercentage).toBe(10);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });
});
