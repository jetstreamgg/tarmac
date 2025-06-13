import { math } from '@jetstreamgg/sky-utils';
import { CollateralRiskParameters } from './vault';
import { formatUnits } from 'viem';
import { RAD_PRECISION, WAD_PRECISION } from '@jetstreamgg/sky-utils';

type RiskParamInputs = {
  par: bigint;
  spot: bigint;
  mat: bigint;
  line: bigint;
  duty: bigint;
  rate: bigint;
  ilkArt: bigint;
  dust: bigint;
};

export function calculateCollateralRiskParams({
  spot,
  rate,
  line,
  dust,
  ilkArt,
  mat,
  duty,
  par
}: RiskParamInputs): CollateralRiskParameters {
  const debtCeiling = BigInt(formatUnits(line, RAD_PRECISION - WAD_PRECISION));
  const totalDaiDebt = ilkArt && math.debtValue(ilkArt, rate);
  return {
    delayedPrice: math.delayedPrice(par, spot, mat),
    debtCeiling,
    debtCeilingUtilization: math.debtCeilingUtilization(debtCeiling, totalDaiDebt),
    stabilityFee: math.annualStabilityFee(duty),
    totalDaiDebt,
    dust: dust,
    minCollateralizationRatio: mat
  };
}
