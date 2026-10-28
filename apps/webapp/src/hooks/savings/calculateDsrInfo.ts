import * as math from '@/utils/math';

type DsrCalcInputs = {
  dsr: bigint;
  pie: bigint;
  Pie: bigint;
  chi: bigint;
};

export function calculateDsrInfo({ dsr, pie, chi, Pie }: DsrCalcInputs) {
  return {
    savingsRate: math.annualDaiSavingsRate(dsr),
    userDsrBalance: math.dsrBalance(pie, chi),
    savingsTvl: math.dsrBalance(Pie, chi)
  };
}
