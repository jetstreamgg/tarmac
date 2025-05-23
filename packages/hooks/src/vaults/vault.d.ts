import { RiskLevel } from './vaults.constants';

export type VaultParams = {
  debtValue?: bigint;
  liquidationPrice?: bigint;
  collateralValue?: bigint;
  collateralAmount?: bigint;
  collateralizationRatio?: bigint;
  delayedPrice?: bigint;
  dust?: bigint;
  minSafeCollateralAmount?: bigint;
  maxSafeBorrowableAmount?: bigint;
  maxSafeBorrowableIntAmount?: bigint;
  liquidationProximityPercentage?: number;
  liquidationRatio?: bigint;
  riskLevel?: RiskLevel;
  minCollateralForDust?: bigint;
  formattedMinCollateralForDust?: string;
  formattedMinSkyCollateralForDust?: string;
};

export type Vault = VaultParams & {
  collateralType: string;
};

type RawValue = {
  value: bigint;
  precision: number;
};

export type VaultRaw = {
  spot: RawValue | undefined; // ray
  rate: RawValue | undefined; // ray
  ink: RawValue | undefined; // wad
  art: RawValue | undefined; // wad
  par: RawValue | undefined; // ray
  mat: RawValue | undefined; // ray
  dust: RawValue | undefined; // rad
  line: RawValue | undefined; // rad
  ilkArt: RawValue | undefined; // wad
  duty: RawValue | undefined; // ray
};

export type CollateralRiskParameters = {
  delayedPrice?: bigint;
  debtCeiling?: bigint;
  debtCeilingUtilization?: number;
  stabilityFee?: bigint;
  totalDaiDebt?: bigint;
  dust?: bigint;
  minCollateralizationRatio?: bigint;
};
