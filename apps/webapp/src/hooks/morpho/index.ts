// Provider-neutral transaction + ERC-4626 data hooks now live in ../vaults.
// Re-exported under their legacy Morpho names as thin aliases so existing
// call sites keep working.
export { useErc4626VaultData as useMorphoVaultOnChainData } from '../vaults/useErc4626VaultData';
export { type MorphoVaultRateData } from './useMorphoVaultRateApiData';
export { useMorphoVaultMarketApiData } from './useMorphoVaultMarketApiData';
export { type MorphoMarketAllocation, type MorphoIdleLiquidityAllocation } from './morpho';
export { useMorphoVaultRewards } from './useMorphoVaultRewards';
export { useMerklRewards, type MerklTokenReward } from './useMerklRewards';
export { useMorphoVaultHistory } from './useMorphoVaultHistory';
export { useMorphoVaultChartInfo, type MorphoVaultChartDataPoint } from './useMorphoVaultChartInfo';
export { useAllMorphoVaultsUserAssets } from './useAllMorphoVaultsUserAssets';
