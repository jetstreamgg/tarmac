// DSProxy
// Savings
export { useSavingsData } from './savings/useSavingsData';
export { useSavingsWithdraw } from './savings/useSavingsWithdraw';
export { useSavingsAllowance } from './savings/useSavingsAllowance';
export { useSavingsHistory } from './savings/useSavingsHistory';
export { useSavingsChartInfo } from './savings/useSavingsChartInfo';
export { useSkySavingsRateHistoricData } from './savings/useSkySavingsRateHistoricData';
export { useReadSavingsUsds, sUsdsAddress } from './savings/useReadSavingsUsds';
export { useBatchSavingsSupply } from './savings/useBatchSavingsSupply';
export { useBatchUpgradeAndSavingsSupply } from './savings/useBatchUpgradeAndSavingsSupply';
export { useBatchPsmSwapAndSavingsSupply } from './savings/useBatchPsmSwapAndSavingsSupply';

// stUSDS
export {
  useStUsdsData,
  useBatchStUsdsDeposit,
  useStUsdsWithdraw,
  useStUsdsAllowance,
  useStUsdsCapacityData,
  useStUsdsHistory,
  useStUsdsChartInfo,
  useStUsdsWithdrawBalances,
  // Provider abstraction layer
  useStUsdsProviderSelection,
  useCurveAllowance,
  useBatchCurveSwap,
  StUsdsProviderType,
  StUsdsSelectionReason,
  StUsdsBlockedReason,
  StUsdsDirection
} from './stusds';

export type {
  // Provider abstraction types

  StUsdsProviderSelectionResult
} from './stusds';

// Morpho Vaults
export {
  useMorphoVaultMarketApiData,
  useMorphoVaultHistory,
  useMorphoVaultChartInfo,
  useMerklRewards
} from './morpho';
export type {
  MorphoVaultRateData,
  MorphoMarketAllocation,
  MorphoIdleLiquidityAllocation,
  MerklTokenReward,
  MorphoVaultChartDataPoint
} from './morpho';

// Provider-neutral vault core
export {
  useBatchVaultDeposit,
  useVaultRedeem,
  useVaultWithdraw,
  useErc4626VaultData,
  useVaultMarketData,
  VAULTS,
  getVaultByAddress,
  type VaultProvider,
  type VaultConfig,
  computeVaultLimits
} from './vaults';

// Pendle (Fixed Yield)
export {
  PENDLE_DEFAULT_SLIPPAGE,
  PENDLE_ROUTER_V4_ADDRESS,
  PENDLE_MARKETS,
  getPendleMarketByAddress,
  getPendleMarketBySlug,
  PendleConvertSide,
  PendleHistoryAction
} from './pendle/constants';
export { isMarketMatured, isPendleChain, formatPendleAggregatorName } from './pendle/helpers';
export { usePendleMarketsApiData } from './pendle/usePendleMarketsApiData';
export { usePendleMarketChartData } from './pendle/usePendleMarketChartData';
export { usePendleUserPtBalances } from './pendle/usePendleUserPtBalances';
export { usePendleMarketHistory } from './pendle/usePendleMarketHistory';
export { useAllPendleMarketsHistory } from './pendle/useAllPendleMarketsHistory';
export { useQuotePendleConvert } from './pendle/useQuotePendleConvert';
export { useBatchPendleConvert } from './pendle/useBatchPendleConvert';
export { usePendleRedeemPreview } from './pendle/usePendleRedeemPreview';
export { usePendleMaturedPositionEarnings } from './pendle/usePendleMaturedPositionEarnings';
export type { PendleMarketConfig, PendleConvertQuote } from './pendle/pendle';

// Authentication
export {
  useRestrictedAddressCheck,
  addressScreeningQueryKey,
  fetchAddressScreening,
  type AddressScreeningResult
} from './authentication/useRestrictedAddressCheck';
export {
  requiresEnhancedScreening,
  enhancedAddressScreeningQueryKey,
  fetchEnhancedAddressScreening
} from './authentication/enhancedAddressScreening';
export { useVpnCheck } from './authentication/useVpnCheck';

// Tokens
export { useTokenAllowance } from './tokens/useTokenAllowance';
export { useTokenBalance, useTokenBalances, type TokenItem } from './tokens/useTokenBalance';
// Rewards
export { useAvailableTokenRewardContracts } from './rewards/useAvailableTokenRewardContracts';
export { useAvailableTokenRewardContractsForChains } from './rewards/useAvailableTokenRewardContracts';
export { useRewardContractInfo } from './rewards/useRewardContractInfo';
export { useAllRewardsUserHistory } from './rewards/useAllRewardsUserHistory';
export { useRewardsChartInfo } from './rewards/useRewardsChartInfo';
export { useMultipleRewardsChartInfo } from './rewards/useMultipleRewardsChartInfo';
export { useRewardContractTokens } from './rewards/useRewardContractTokens';
export { useUserRewardsBalance } from './rewards/useUserRewardsBalance';
export { useRewardsWithUserBalance } from './rewards/useRewardsWithUserBalance';
export { useBatchRewardsSupply } from './rewards/useBatchRewardsSupply';
// Rewards
export { useRewardsWithdraw } from './rewards/useRewardsWithdraw';
export { useRewardsRewardsBalance } from './rewards/useRewardsRewardsBalance';
export { useRewardsSuppliedBalance } from './rewards/useRewardsBalance';
export { useRewardContractsToClaim } from './rewards/useRewardContractsToClaim';
export { isDeprecatedRewardContract } from './rewards/deprecatedRewards';

// Shared
export { useCombinedHistory } from './shared/useCombinedHistory';
export { useAllNetworksCombinedHistory } from './shared/useAllNetworksCombinedHistory';
export { useFilteredPortfolioHistory } from './shared/useFilteredPortfolioHistory';
export { useUsdsDaiData } from './shared/useUsdsDaiData';
export { useOverallSkyData } from './shared/useOverallSkyData';
export { trailingAverageRate } from './shared/trailingRate';

// Earn marketplace (C1 registry + aggregator)
export { useEarnMarketplace } from './earn/useEarnMarketplace';
export {
  buildRewardsProduct,
  productNetworks,
  rewardsRiskProfile,
  RISK_TIER_BY_PROFILE
} from './earn/earnProducts';
export { useProductNetworks } from './earn/useProductNetworks';
export type {
  EarnProductKind,
  EarnRiskProfileId,
  EarnProductRow,
  EarnRate,
  EarnRiskTier,
  EarnUsdAmount
} from './earn/types';

// Decentralized Storage
// Setup
// Upgrade
export { useMkrSkyFee } from './upgrade/useMkrSkyFee';
export { useBatchUpgrade } from './upgrade/useBatchUpgrade';
export type { UpgradeSourceToken } from './upgrade/useBatchUpgrade';

// Trade
// Oracles
// Prices
export { usePrices } from './prices/usePrices';
export { useSkyPrice } from './prices/useSkyPrice';
export { useStakeHistory } from './stake/useStakeHistory';
export { useStakeHistoricData } from './stake/useStakeHistoricData';

// Stake Module
export { useStakeRewardContracts } from './stake/useStakeRewardContracts';
export { useStakeUserDelegates } from './stake/useStakeUserDelegates';
export { useCurrentUrnIndex } from './stake/useCurrentUrnIndex';
export { useUrnAddress as useStakeUrnAddress } from './stake/useUrnAddress';
export { useUrnSelectedRewardContract as useStakeUrnSelectedRewardContract } from './stake/useUrnSelectedRewardContract';
export { useUrnSelectedVoteDelegate as useStakeUrnSelectedVoteDelegate } from './stake/useUrnSelectedVoteDelegate';
export { useStakeSkyAllowance, useStakeUsdsAllowance } from './stake/useStakeAllowance';
export { useBatchStakeMulticall } from './stake/useBatchStakeMulticall';
export { useHighestRateFromChartData } from './stake/useHighestRateFromChartData';
export { useBorrowCapacityData } from './stake/useBorrowCapacityData';
export * from './stake/calldata';
export { isDeprecatedStakeReward, filterDeprecatedRewards } from './stake/deprecatedRewards';

//Vaults
export { useVault } from './vaults/useVault';
export { useCollateralData } from './vaults/useCollateralData';
export { useSimulatedVault } from './vaults/useSimulatedVault';
export { RiskLevel, RISK_LEVEL_THRESHOLDS } from './vaults/vaults.constants';

//Delegates
export { useDelegateName } from './delegates/useDelegateName';
// PSM
export { useBatchPsmSwapExactIn } from './psm/useBatchPsmSwapExactIn';
export { useBatchPsmSwapExactOut } from './psm/useBatchPsmSwapExactOut';
export { usePsmLiquidity } from './psm/usePsmLiquidity';
export { usePreviewSwapExactIn } from './psm/usePreviewSwapExactIn';
export { usePreviewSwapExactOut } from './psm/usePreviewSwapExactOut';
export { usdsPsmWrapperAddress } from './generated';
export { useBatchUsdsPsmWrapperSellGem } from './psm/useBatchUsdsPsmWrapperSellGem';
export { useBatchUsdsPsmWrapperBuyGem } from './psm/useBatchUsdsPsmWrapperBuyGem';
export {
  useUsdsPsmWrapperTin,
  useUsdsPsmWrapperTout,
  useUsdsPsmWrapperLive,
  useUsdsPsmWrapperHalted
} from './psm/useUsdsPsmWrapperReads';
export { usePsmPocketBalance } from './psm/usePsmPocketBalance';

export { ModuleEnum, TransactionTypeEnum, ZERO_ADDRESS, TENDERLY_CHAIN_ID } from './constants';

export { getIlkName } from './vaults/helpers';
export { toError } from './helpers';

export { TOKENS, getTokenDecimals } from './tokens/tokens.constants';

// Export types
export type { WriteHook, BatchWriteHookParams, TxMutateVariables } from './hooks';
export type { RewardContract } from './rewards/rewards';
export type { Token, TokenForChain } from './tokens/types';
export type { CombinedHistoryItem } from './shared/shared';
export type { RewardsChartInfoParsed } from './rewards/useRewardsChartInfo';
export type { Vault, CollateralRiskParameters } from './vaults/vault';
// Generated hooks and contracts data
export {
  daiUsdsAddress,
  usdsAddress,
  mkrAddress,
  mkrSkyAddress,
  usdsSkyRewardAddress,
  mcdDaiAddress,
  skyAddress,
  wethAddress,
  usdcAddress,
  usdtAddress,
  spkAddress,
  stakeModuleAddress,
  stakeModuleAbi,
  mcdVatAbi,
  mcdVatAddress,
  usdcL2Address,
  usdsL2Address,
  stUsdsAddress,
  sUsdsL2Address,
  psm3L2Address,
  useReadSsrAuthOracleGetChi,
  useReadSsrAuthOracleGetRho,
  useReadSsrAuthOracleGetSsr,
  lsSkyUsdsRewardAddress,
  lsSkySpkRewardAddress,
  lsSkySkyRewardAddress
} from './generated';
export { contracts, l2Contracts } from './contracts';

export { useTransactionFlow } from './shared/useTransactionFlow';
export { getWriteContractCall } from './shared/getWriteContractCall';
export { useIsBatchSupported } from './shared/useIsBatchSupported';
export { useNetworkFee } from './shared/useNetworkFee';
export type { NetworkFeeData, UseNetworkFeeParameters } from './shared/useNetworkFee';

// UI utility hooks
export * from './ui';

// Wallet classification hooks
export * from './wallet';
