// Provider-neutral transaction + ERC-4626 data hooks now live in ../vaults.
// Re-exported under their legacy Morpho names as thin aliases so existing
// call sites keep working.
export { useBatchVaultDeposit as useBatchMorphoVaultDeposit } from '../vaults/useBatchVaultDeposit';
export { useVaultWithdraw as useMorphoVaultWithdraw } from '../vaults/useVaultWithdraw';
export { useVaultRedeem as useMorphoVaultRedeem } from '../vaults/useVaultRedeem';
export { useErc4626VaultData as useMorphoVaultOnChainData } from '../vaults/useErc4626VaultData';
export {
  useMorphoVaultRateApiData,
  useMorphoVaultMultipleRateApiData,
  type MorphoVaultRateData,
  type MorphoVaultRateHook,
  type MorphoVaultMultipleRateHook,
  type MorphoRewardData
} from './useMorphoVaultRateApiData';
export { useMorphoVaultAllocations } from './useMorphoVaultAllocations';
export {
  useMorphoVaultMarketApiData,
  fetchMorphoVaultMarketData,
  type MorphoVaultMarketData,
  type MorphoVaultMarketDataHook
} from './useMorphoVaultMarketApiData';
export {
  type MorphoMarketAllocation,
  type MorphoV1VaultAllocation,
  type MorphoIdleLiquidityAllocation,
  type MorphoVaultAllocationsData,
  type MorphoVaultAllocationsHook
} from './morpho';
export {
  useMorphoVaultRewards,
  type MorphoVaultReward,
  type MorphoVaultRewardsData,
  type MorphoVaultRewardsHook
} from './useMorphoVaultRewards';
export {
  useMerklRewards,
  type MerklTokenReward,
  type MerklRewardSource,
  type MerklRewardsData,
  type MerklRewardsHook
} from './useMerklRewards';
export { useMerklClaimRewards } from './useMerklClaimRewards';
export { useMorphoVaultHistory } from './useMorphoVaultHistory';
export {
  useMorphoVaultChartInfo,
  useMorphoVaultMultipleChartInfo,
  type MorphoVaultChartDataPoint,
  type MorphoVaultChartInfoHook,
  type MorphoVaultMultipleChartInfoHook
} from './useMorphoVaultChartInfo';
export {
  useMorphoVaultSupplierAddresses,
  type MorphoVaultSupplierAddressesHook
} from './useMorphoVaultSupplierAddresses';
export { useMorphoVaultsCombinedTvl, type MorphoVaultsCombinedTvl } from './useMorphoVaultsCombinedTvl';
export {
  useAllMorphoVaultsUserAssets,
  type MorphoVaultBalance,
  type AllMorphoVaultsUserAssetsData
} from './useAllMorphoVaultsUserAssets';
export { MORPHO_VAULTS } from './constants';
