import { describe, expect, it } from 'vitest';
import { formatUnits, parseUnits } from 'viem';
import { calculateVaultInfo } from './calculateVaultInfo';
import { math, RAD_PRECISION, RAY_PRECISION, WAD_PRECISION } from '@jetstreamgg/sky-utils';
import { RISK_LEVEL_THRESHOLDS, RiskLevel } from './vaults.constants';

const computeLiquidationProximity = (
  debtValue: bigint,
  liquidationPrice: bigint,
  marketPrice: bigint,
  collateralValue: bigint
): number => {
  if (debtValue === 0n) {
    return 0;
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
      expectedCollateralValue
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
});
