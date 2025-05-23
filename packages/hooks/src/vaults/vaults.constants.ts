export enum SupportedCollateralTypes {
  LSE_MKR_A = 'LSE-MKR-A', // Seal Engine ilk name
  LSEV2_A = 'LSEV2-A', // Staking engine ilk name in Tenderly. TODO: remove it and replace it for `LSEV2_SKY_A` once we have new testnet
  LSEV2_SKY_A = 'LSEV2-SKY-A' // Staking engine ilk name in Mainnet
}

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
