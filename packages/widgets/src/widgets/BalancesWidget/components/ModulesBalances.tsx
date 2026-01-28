import {
  TOKENS,
  useAvailableTokenRewardContracts,
  useMultiChainSavingsBalances,
  useRewardsSuppliedBalance,
  useStUsdsData,
  useTotalUserSealed,
  useTotalUserStaked,
  useMorphoVaultOnChainData,
  MORPHO_VAULTS
} from '@jetstreamgg/sky-hooks';
import { RewardsBalanceCard } from './RewardsBalanceCard';
import { SavingsBalanceCard } from './SavingsBalanceCard';
import { SealBalanceCard } from './SealBalanceCard';
import { StakeBalanceCard } from './StakeBalanceCard';
import { ExpertBalanceCard } from './ExpertBalanceCard';
import { chainId, isMainnetId, isTestnetId } from '@jetstreamgg/sky-utils';
import { useChainId, useConnection } from 'wagmi';

export enum ModuleCardVariant {
  default = 'default',
  alt = 'alt'
}

export interface CardProps {
  url?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
  loading?: boolean;
  error?: string;
  totalUserRewardsSupplied?: bigint;
  savingsBalances?: { chainId: number; balance: bigint }[];
  sealBalance?: bigint;
  stakeBalance?: bigint;
  variant?: ModuleCardVariant;
}

interface ModulesBalancesProps {
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
  stakeCardUrl?: string;
  stusdsCardUrl?: string;
  variant?: ModuleCardVariant;
  hideZeroBalances?: boolean;
  showAllNetworks?: boolean;
}

export const ModulesBalances = ({
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  onExternalLinkClicked,
  chainIds,
  stakeCardUrl,
  stusdsCardUrl,
  variant = ModuleCardVariant.default,
  hideZeroBalances = false,
  showAllNetworks = true
}: ModulesBalancesProps): React.ReactElement => {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const mainnetChainId = isTestnetId(currentChainId) ? chainId.tenderly : chainId.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(mainnetChainId);

  const usdsSkyRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.sky.symbol
  );
  const usdsCleRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.cle.symbol
  );
  const usdsSpkRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.spk.symbol
  );

  const {
    data: usdsSkySuppliedBalance,
    isLoading: usdsSkySuppliedBalanceLoading,
    error: usdsSkySuppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsSkyRewardContract?.contractAddress as `0x${string}`
  });

  const {
    data: usdsSpkSuppliedBalance,
    isLoading: usdsSpkSuppliedBalanceLoading,
    error: usdsSpkSuppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsSpkRewardContract?.contractAddress as `0x${string}`
  });

  const {
    data: usdsCleSuppliedBalance,
    isLoading: usdsCleSuppliedBalanceIsLoading,
    error: usdsCleSuppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsCleRewardContract?.contractAddress as `0x${string}`
  });

  const rewardsLoading =
    usdsSkySuppliedBalanceLoading || usdsSpkSuppliedBalanceLoading || usdsCleSuppliedBalanceIsLoading;

  const suppliedBalanceError =
    usdsSkySuppliedBalanceError || usdsCleSuppliedBalanceError || usdsSpkSuppliedBalanceError;

  const totalUserRewardsSupplied =
    usdsSkySuppliedBalance !== undefined &&
    usdsCleSuppliedBalance !== undefined &&
    usdsSpkSuppliedBalance !== undefined
      ? usdsSkySuppliedBalance + usdsCleSuppliedBalance + usdsSpkSuppliedBalance
      : 0n;

  const { data: totalUserSealed, isLoading: sealLoading, error: totalUserSealedError } = useTotalUserSealed();
  const {
    data: totalUserStaked,
    isLoading: stakeLoading,
    error: totalUserStakedError
  } = useTotalUserStaked();

  const { data: stUsdsData, isLoading: stUsdsLoading, error: stUsdsError } = useStUsdsData();

  // Get Morpho vault data for expert balance card
  const defaultMorphoVault = MORPHO_VAULTS[0];
  const morphoVaultAddress = defaultMorphoVault?.vaultAddress[mainnetChainId];
  const {
    data: morphoData,
    isLoading: morphoLoading,
    error: morphoError
  } = useMorphoVaultOnChainData({
    vaultAddress: morphoVaultAddress
  });

  // Combined expert savings balance (stUSDS + Morpho)
  const totalExpertSavingsBalance = (stUsdsData?.userSuppliedUsds || 0n) + (morphoData?.userAssets || 0n);
  const expertLoading = stUsdsLoading || morphoLoading;

  const {
    data: multichainSavingsBalances,
    isLoading: savingsLoading,
    error: multichainSavingsBalancesError
  } = useMultiChainSavingsBalances({ chainIds });

  const sortedSavingsBalances = Object.entries(multichainSavingsBalances ?? {})
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
    .map(([chainId, balance]) => ({
      chainId: Number(chainId),
      balance
    }));

  const savingsBalancesWithBalanceFilter = hideZeroBalances
    ? sortedSavingsBalances.filter(({ balance }) => balance > 0n)
    : sortedSavingsBalances;

  const filteredAndSortedSavingsBalances = showAllNetworks
    ? savingsBalancesWithBalanceFilter
    : savingsBalancesWithBalanceFilter.filter(({ chainId }) => chainId === currentChainId);

  const totalSavingsBalance = filteredAndSortedSavingsBalances?.reduce(
    (acc, { balance }) => acc + balance,
    0n
  );

  const hideRewards = Boolean(
    suppliedBalanceError ||
      (totalUserRewardsSupplied === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const hideSeal = Boolean(
    totalUserSealedError ||
      (totalUserSealed === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const hideStake = Boolean(
    totalUserStakedError ||
      (totalUserStaked === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const hideExpert = Boolean(
    !stusdsCardUrl || // Hide if no URL is provided (feature flag disabled)
      (stUsdsError && morphoError) ||
      (totalExpertSavingsBalance === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const hideSavings = Boolean(
    multichainSavingsBalancesError || (totalSavingsBalance === 0n && hideZeroBalances)
  );

  const hideModuleBalances = hideSavings && hideRewards && hideSeal;

  return (
    <div className="flex flex-col gap-2">
      {!hideModuleBalances && !hideRewards && (
        <RewardsBalanceCard
          url={rewardsCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={rewardsLoading}
          totalUserRewardsSupplied={totalUserRewardsSupplied}
          variant={variant}
        />
      )}
      {!hideModuleBalances && !hideSavings && (
        <SavingsBalanceCard
          urlMap={savingsCardUrlMap ?? {}}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={savingsLoading}
          savingsBalances={filteredAndSortedSavingsBalances}
          variant={variant}
        />
      )}
      {!hideModuleBalances && !hideExpert && (
        <ExpertBalanceCard
          url={stusdsCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={expertLoading}
          variant={variant}
        />
      )}
      {!hideStake && (
        <StakeBalanceCard
          loading={stakeLoading}
          stakeBalance={totalUserStaked}
          onExternalLinkClicked={onExternalLinkClicked}
          url={stakeCardUrl}
          variant={variant}
        />
      )}
      {!hideSeal && (
        <SealBalanceCard
          onExternalLinkClicked={onExternalLinkClicked}
          url={sealCardUrl}
          loading={sealLoading}
          sealBalance={totalUserSealed}
          variant={variant}
        />
      )}
    </div>
  );
};
