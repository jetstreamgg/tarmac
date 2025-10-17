export enum SupportedCollateralTypes {
  LSE_MKR_A = 'LSE-MKR-A', // Seal Engine ilk name
  LSEV2_SKY_A = 'LSEV2-SKY-A' // Staking engine ilk name in Mainnet
}

export const COLLATERAL_PRICE_SYMBOL: Record<SupportedCollateralTypes, string> = {
  [SupportedCollateralTypes.LSE_MKR_A]: 'MKR',
  [SupportedCollateralTypes.LSEV2_SKY_A]: 'SKY'
};

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  LIQUIDATION = 'LIQUIDATION'
}

export const RISK_LEVEL_THRESHOLDS = [
  { level: RiskLevel.LIQUIDATION, threshold: 80 },
  { level: RiskLevel.HIGH, threshold: 40 },
  { level: RiskLevel.MEDIUM, threshold: 25 },
  { level: RiskLevel.LOW, threshold: 0 }
] as const;
