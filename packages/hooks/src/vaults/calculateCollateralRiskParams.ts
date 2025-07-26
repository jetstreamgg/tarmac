import { math } from '@jetstreamgg/sky-utils';
import { CollateralRiskParameters } from './vault';

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
  const debtCeiling = math.convertRadToWad(line);
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
