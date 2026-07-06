export { type VaultProvider, type VaultConfig } from './types';
export { VAULTS, getVaultByAddress } from './constants';
export { SPARK_VAULTS, SPARK_SAVINGS_API_HOST, SPARK_VAULT_IDENTITY } from './spark/constants';
export { useSparkVaultApiData } from './spark/useSparkVaultApiData';
export { normalizeSparkCurrentData, normalizeSparkHistoricData } from './spark/normalizeSparkVaultData';
export {
  buildSparkSavingsUrl,
  fetchSparkSavingsCurrent,
  fetchSparkSavingsHistoric,
  type SparkVaultIdentity,
  type SparkSavingsCurrentResponse,
  type SparkSavingsCurrentData,
  type SparkSavingsTokenInfo,
  type SparkSavingsLiquidityEntry,
  type SparkSavingsCollateralEntry,
  type SparkSavingsCollateralComposition,
  type SparkSavingsHistoricResponse,
  type SparkSavingsHistoricEntry
} from './spark/sparkSavingsApi';
export { useErc4626VaultData, type Erc4626VaultData, type Erc4626VaultDataHook } from './useErc4626VaultData';
export { useSparkVaultRate } from './spark/useSparkVaultRate';
export { useSparkVaultResolvedRate } from './spark/useSparkVaultResolvedRate';
export { useSusdtVaultHistory } from './spark/useSusdtVaultHistory';
export {
  type SusdtVaultHistory,
  type SusdtVaultHistoryItem,
  type SusdtVaultSupply,
  type SusdtVaultWithdrawal
} from './spark/susdtVaultHistory';
export { useVaultRatesByAddress, type VaultRatesByAddressHook } from './useVaultRatesByAddress';
export { computeVaultLimits, type VaultLimits, type VaultLimitsInput } from './computeVaultLimits';
export { useBatchVaultDeposit } from './useBatchVaultDeposit';
export { useVaultRedeem } from './useVaultRedeem';
export { useVaultWithdraw } from './useVaultWithdraw';
export {
  useVaultMarketData,
  type UseVaultMarketDataParams,
  type VaultMarketDataHook,
  type NormalizedVaultMarketData,
  type NormalizedVaultAllocation,
  type NormalizedVaultHistoryPoint
} from './useVaultMarketData';
