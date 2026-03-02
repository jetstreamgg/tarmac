import {
  TOKENS,
  useAvailableTokenRewardContracts,
  useMultiChainSavingsBalances,
  useRewardsSuppliedBalance,
  useStUsdsData,
  useTotalUserSealed,
  useTotalUserStaked,
  useAllMorphoVaultsUserAssets,
  usePrices
} from '@jetstreamgg/sky-hooks';
import { RewardsBalanceCard } from './RewardsBalanceCard';
import { SavingsBalanceCard } from './SavingsBalanceCard';
import { SealBalanceCard } from './SealBalanceCard';
import { StakeBalanceCard } from './StakeBalanceCard';
import { ExpertBalanceCard } from './ExpertBalanceCard';
import { VaultsBalanceCard } from './VaultsBalanceCard';
import { chainId, isMainnetId, isTestnetId } from '@jetstreamgg/sky-utils';
import { useChainId, useConnection } from 'wagmi';
import { useEffect, useMemo } from 'react';
import { SuppliedFundsEmptyState } from './SuppliedFundsEmptyState';

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
  hideModuleBalances?: boolean;
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
  stakeCardUrl?: string;
  stusdsCardUrl?: string;
  morphoCardUrl?: string;
  variant?: ModuleCardVariant;
  hideZeroBalances?: boolean;
  showAllNetworks?: boolean;
  onAllFundsEmpty?: (isEmpty: boolean) => void;
}

export const ModulesBalances = ({
  hideModuleBalances: hideModuleBalancesProp,
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  onExternalLinkClicked,
  chainIds,
  stakeCardUrl,
  stusdsCardUrl,
  morphoCardUrl,
  variant = ModuleCardVariant.default,
  hideZeroBalances = false,
  showAllNetworks = true,
  onAllFundsEmpty
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

  // Get aggregate Morpho vault data across all vaults
  const {
    data: totalMorphoUserAssets,
    isLoading: morphoLoading,
    error: morphoError
  } = useAllMorphoVaultsUserAssets();

  // Combined expert savings balance (stUSDS + Morpho)
  const totalExpertSavingsBalance = (stUsdsData?.userSuppliedUsds || 0n) + totalMorphoUserAssets;
  const expertLoading = stUsdsLoading || morphoLoading;

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

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

  const hideVaults = Boolean(
    morphoError ||
      (totalMorphoUserAssets === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const hideSavings = Boolean(
    multichainSavingsBalancesError || (totalSavingsBalance === 0n && hideZeroBalances)
  );

  const hideModuleBalancesLocal = hideSavings && hideRewards && hideSeal;
  const hideModuleBalances = hideModuleBalancesProp || hideModuleBalancesLocal;

  // Fallback display order used while prices are loading to prevent layout shifts
  const fallbackOrder: Record<string, number> = {
    rewards: 0,
    savings: 1,
    staking: 2,
    vaults: 3,
    stusds: 4,
    seal: 5
  };

  // Compute USD value for each module to sort by value descending
  const bigintToUsd = (balance: bigint, priceStr: string) =>
    parseFloat((Number(balance) / 1e18).toString()) * parseFloat(priceStr);

  const anyBalanceLoading = rewardsLoading || savingsLoading || stakeLoading || expertLoading || sealLoading;
  const canSortByValue = !anyBalanceLoading && !pricesLoading && !!pricesData;

  const moduleUsdValues = useMemo(() => {
    if (!canSortByValue || !pricesData) return {};

    const values: Record<string, number> = {};
    values.rewards =
      totalUserRewardsSupplied && pricesData.USDS
        ? bigintToUsd(totalUserRewardsSupplied, pricesData.USDS.price)
        : 0;
    values.savings =
      totalSavingsBalance && pricesData.USDS
        ? bigintToUsd(totalSavingsBalance, pricesData.USDS.price)
        : 0;
    values.staking =
      totalUserStaked && pricesData.SKY ? bigintToUsd(totalUserStaked, pricesData.SKY.price) : 0;
    values.vaults =
      totalMorphoUserAssets && pricesData.USDS
        ? bigintToUsd(totalMorphoUserAssets, pricesData.USDS.price)
        : 0;
    values.stusds =
      totalExpertSavingsBalance && pricesData.USDS
        ? bigintToUsd(totalExpertSavingsBalance, pricesData.USDS.price)
        : 0;
    values.seal =
      totalUserSealed && pricesData.MKR ? bigintToUsd(totalUserSealed, pricesData.MKR.price) : 0;

    return values;
  }, [
    canSortByValue,
    pricesData,
    totalUserRewardsSupplied,
    totalSavingsBalance,
    totalUserStaked,
    totalMorphoUserAssets,
    totalExpertSavingsBalance,
    totalUserSealed
  ]);

  const sortedModules = useMemo(() => {
    const modules: Array<{
      id: 'rewards' | 'savings' | 'stusds' | 'staking' | 'seal' | 'vaults';
      hidden: boolean;
    }> = [
      { id: 'rewards', hidden: hideModuleBalances || hideRewards },
      { id: 'savings', hidden: hideModuleBalances || hideSavings },
      { id: 'staking', hidden: hideStake },
      { id: 'vaults', hidden: hideVaults },
      { id: 'stusds', hidden: hideModuleBalances || hideExpert },
      { id: 'seal', hidden: hideSeal }
    ];

    const visible = modules.filter(m => !m.hidden);

    if (canSortByValue) {
      // Sort by USD value descending, fall back to default order for ties
      return visible.sort((a, b) => {
        const diff = (moduleUsdValues[b.id] ?? 0) - (moduleUsdValues[a.id] ?? 0);
        return diff !== 0 ? diff : fallbackOrder[a.id] - fallbackOrder[b.id];
      });
    }

    // While loading, use stable fallback order to prevent layout shifts
    return visible.sort((a, b) => fallbackOrder[a.id] - fallbackOrder[b.id]);
  }, [
    hideModuleBalances,
    hideRewards,
    hideSavings,
    hideExpert,
    hideStake,
    hideSeal,
    hideVaults,
    canSortByValue,
    moduleUsdValues
  ]);

  // Check if all supplied funds are zero (before any filtering)
  const totalRawSavingsBalance = sortedSavingsBalances.reduce((acc, { balance }) => acc + balance, 0n);
  const isAllLoaded = !rewardsLoading && !savingsLoading && !sealLoading && !stakeLoading && !expertLoading;
  const allFundsEmpty =
    isAllLoaded &&
    totalUserRewardsSupplied === 0n &&
    totalRawSavingsBalance === 0n &&
    (totalUserSealed ?? 0n) === 0n &&
    (totalUserStaked ?? 0n) === 0n &&
    totalExpertSavingsBalance === 0n;

  useEffect(() => {
    onAllFundsEmpty?.(allFundsEmpty);
  }, [allFundsEmpty, onAllFundsEmpty]);

  if (allFundsEmpty) {
    return <SuppliedFundsEmptyState />;
  }

  // Render functions for each module type
  const renderModule = (moduleId: 'rewards' | 'savings' | 'stusds' | 'staking' | 'seal' | 'vaults') => {
    switch (moduleId) {
      case 'rewards':
        return (
          <RewardsBalanceCard
            key="rewards"
            url={rewardsCardUrl}
            onExternalLinkClicked={onExternalLinkClicked}
            loading={rewardsLoading}
            totalUserRewardsSupplied={totalUserRewardsSupplied}
            variant={variant}
          />
        );
      case 'savings':
        return (
          <SavingsBalanceCard
            key="savings"
            urlMap={savingsCardUrlMap ?? {}}
            onExternalLinkClicked={onExternalLinkClicked}
            loading={savingsLoading}
            savingsBalances={filteredAndSortedSavingsBalances}
            variant={variant}
          />
        );
      case 'stusds':
        return (
          <ExpertBalanceCard
            key="stusds"
            url={stusdsCardUrl}
            onExternalLinkClicked={onExternalLinkClicked}
            loading={expertLoading}
            variant={variant}
          />
        );
      case 'staking':
        return (
          <StakeBalanceCard
            key="staking"
            loading={stakeLoading}
            stakeBalance={totalUserStaked}
            onExternalLinkClicked={onExternalLinkClicked}
            url={stakeCardUrl}
            variant={variant}
          />
        );
      case 'seal':
        return (
          <SealBalanceCard
            key="seal"
            onExternalLinkClicked={onExternalLinkClicked}
            url={sealCardUrl}
            loading={sealLoading}
            sealBalance={totalUserSealed}
            variant={variant}
          />
        );
      case 'vaults':
        return (
          <VaultsBalanceCard
            key="vaults"
            url={morphoCardUrl}
            onExternalLinkClicked={onExternalLinkClicked}
            variant={variant}
          />
        );
    }
  };

  return <div className="flex flex-col gap-2">{sortedModules.map(module => renderModule(module.id))}</div>;
};
