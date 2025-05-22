import { RAD_PRECISION, RAY_PRECISION, WAD_PRECISION, math } from '@jetstreamgg/utils';
import { VaultParams } from './vault';
import { formatUnits } from 'viem';
import { RISK_LEVEL_THRESHOLDS, RiskLevel } from './vaults.constants';

type VaultCalcInputs = {
  spot: bigint;
  rate: bigint;
  art: bigint;
  ink: bigint;
  par: bigint;
  mat: bigint;
  dust: bigint;
};

export function calculateVaultInfo({ spot, rate, art, ink, par, mat, dust }: VaultCalcInputs): VaultParams {
  const debtValue = math.debtValue(art, rate);
  const delayedPrice = math.delayedPrice(par, spot, mat);
  const minSafeCollateralAmount = math.minSafeCollateralAmount(debtValue, mat, delayedPrice);
  const collateralValue = math.collateralValue(ink, math.delayedPrice(par, spot, mat));
  const maxSafeBorrowableAmount = math.daiAvailable(collateralValue, debtValue, mat);
  const collateralizationRatio = math.collateralizationRatio(collateralValue, debtValue);
  const liquidationPrice = math.liquidationPrice(ink, math.debtValue(art, rate), mat);

  const liquidationProximityPercentage = calculateLiquidationProximityPercentage(
    debtValue,
    liquidationPrice,
    delayedPrice,
    collateralValue
  );
  const riskLevel = calculateRiskLevel(liquidationProximityPercentage);

  return {
    debtValue,
    liquidationPrice,
    collateralValue,
    collateralAmount: ink,
    collateralizationRatio,
    delayedPrice,
    // TODO: check if this approach is valid
    // If dust is less than the smallest unit of WAD, set it to the smallest unit of WAD
    dust: math.convertRadToWad(dust) === 0n ? 1n : BigInt(formatUnits(dust, RAD_PRECISION - WAD_PRECISION)),
    minSafeCollateralAmount,
    maxSafeBorrowableAmount,
    maxSafeBorrowableIntAmount: math.removeDecimalPartOfWad(maxSafeBorrowableAmount), // wad
    liquidationProximityPercentage,
    riskLevel
  };
}

function calculateLiquidationProximityPercentage(
  debtValue: bigint,
  liquidationPrice: bigint,
  delayedPrice: bigint,
  collateralValue: bigint
): number {
  if (debtValue === 0n) {
    return 0;
  }
  if (liquidationPrice >= delayedPrice) {
    return 100;
  }
  if (collateralValue === 0n && debtValue > 0n) {
    return 100;
  }

  const proximityPercentage = Number(((delayedPrice - liquidationPrice) * 100n) / delayedPrice);
  return 100 - proximityPercentage;
}

function calculateRiskLevel(liquidationProximityPercentage: number): RiskLevel {
  return (
    RISK_LEVEL_THRESHOLDS.find(({ threshold }) => liquidationProximityPercentage >= threshold)?.level ||
    RiskLevel.LOW
  );
}

export function rawVaultInfo({
  spot,
  rate,
  ink,
  art,
  par,
  mat,
  dust,
  line,
  ilkArt,
  duty
}: Partial<VaultCalcInputs> & { line?: bigint; ilkArt?: bigint; duty?: bigint }) {
  return {
    spot: createRawValue(spot, RAY_PRECISION),
    rate: createRawValue(rate, RAY_PRECISION),
    ink: createRawValue(ink, WAD_PRECISION),
    art: createRawValue(art, WAD_PRECISION),
    par: createRawValue(par, RAY_PRECISION),
    mat: createRawValue(mat, RAY_PRECISION),
    dust: createRawValue(dust, RAD_PRECISION),
    line: createRawValue(line, RAD_PRECISION),
    ilkArt: createRawValue(ilkArt, WAD_PRECISION),
    duty: createRawValue(duty, RAY_PRECISION)
  };
}

function createRawValue(value: bigint | undefined, precision: number) {
  return value ? { value, precision } : undefined;
}
