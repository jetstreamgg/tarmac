import { SupportedCollateralTypes } from './vaults.constants';

export const getIlkName = (version: number = 1): SupportedCollateralTypes => {
  return version === 1 ? SupportedCollateralTypes.LSE_MKR_A : SupportedCollateralTypes.LSEV2_SKY_A;
};
