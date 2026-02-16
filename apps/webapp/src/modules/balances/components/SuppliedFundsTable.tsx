import { Table, TableBody } from '@/components/ui/table';
import { SuppliedFundsTableHeader } from './SuppliedFundsTableHeader';
import { SuppliedFundsTableRow } from './SuppliedFundsTableRow';
import { SuppliedFundsSavingsRow } from './SuppliedFundsSavingsRow';
import { SuppliedFundsExpertRow } from './SuppliedFundsExpertRow';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { useAccount, useChainId } from 'wagmi';
import {
  usePrices,
  useAvailableTokenRewardContracts,
  useRewardsSuppliedBalance,
  useMultiChainSavingsBalances,
  useTotalUserStaked,
  useStUsdsData,
  useOverallSkyData,
  TOKENS,
  useHighestRateFromChartData,
  useRewardsChartInfo,
  useStakeRewardContracts,
  useMultipleRewardsChartInfo,
  useMorphoVaultOnChainData,
  useMorphoVaultMultipleRateApiData,
  MORPHO_VAULTS
} from '@jetstreamgg/sky-hooks';
import {
  isTestnetId,
  isMainnetId,
  formatDecimalPercentage,
  chainId as chainIdConstants,
  calculateApyFromStr
} from '@jetstreamgg/sky-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { formatUnits } from 'viem';
import { Fragment, useMemo } from 'react';
import { MODULE_ICONS } from '../constants';

type SuppliedFundsTableProps = {
  chainIds?: number[];
};

export function SuppliedFundsTable({ chainIds }: SuppliedFundsTableProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const chainsToQuery = chainIds ?? [currentChainId];
  const { showAllNetworks, hideZeroBalances } = useBalanceFilters();

  // Prices
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Rewards data
  const mainnetChainId = isTestnetId(currentChainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(mainnetChainId);

  const usdsSkyRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.sky.symbol
  );
  const usdsSpkRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.spk.symbol
  );
  const usdsCleRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.cle.symbol
  );

  const { data: usdsSkySuppliedBalance, isLoading: usdsSkyLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsSkyRewardContract?.contractAddress as `0x${string}`
  });

  const { data: usdsSpkSuppliedBalance, isLoading: usdsSpkLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsSpkRewardContract?.contractAddress as `0x${string}`
  });

  const { data: usdsCleSuppliedBalance, isLoading: usdsCleLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: usdsCleRewardContract?.contractAddress as `0x${string}`
  });

  // Rewards rate
  const { data: usdsSkyChartData, isLoading: usdsSkyChartLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSkyRewardContract?.contractAddress as string,
    limit: 1
  });
  const { data: usdsSpkChartData, isLoading: usdsSpkChartLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSpkRewardContract?.contractAddress as string,
    limit: 1
  });
  const rewardsHighestRate = useHighestRateFromChartData([usdsSkyChartData, usdsSpkChartData]);

  const rewardsLoading = usdsSkyLoading || usdsSpkLoading || usdsCleLoading;
  const totalUserRewardsSupplied =
    (usdsSkySuppliedBalance ?? 0n) + (usdsSpkSuppliedBalance ?? 0n) + (usdsCleSuppliedBalance ?? 0n);

  // Savings data
  const { data: multichainSavingsBalances, isLoading: savingsLoading } = useMultiChainSavingsBalances({
    chainIds: chainsToQuery
  });
  const { data: overallSkyData, isLoading: overallSkyDataLoading } = useOverallSkyData();

  const sortedSavingsBalances = Object.entries(multichainSavingsBalances ?? {})
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
    .map(([chainId, balance]) => ({
      chainId: Number(chainId),
      balance
    }));

  // All savings balances with non-zero amounts (used for "Funds by network" expandable)
  const allNonZeroSavingsBalances = hideZeroBalances
    ? sortedSavingsBalances.filter(({ balance }) => balance > 0n)
    : sortedSavingsBalances;

  // Savings balances filtered by current network (used for total display)
  const displayedSavingsBalances = showAllNetworks
    ? allNonZeroSavingsBalances
    : allNonZeroSavingsBalances.filter(({ chainId }) => chainId === currentChainId);

  const totalSavingsBalance = displayedSavingsBalances.reduce((acc, { balance }) => acc + balance, 0n);
  const savingsRate = parseFloat(overallSkyData?.skySavingsRatecRate ?? '0');

  // Staking data
  const { data: totalUserStaked, isLoading: stakeLoading } = useTotalUserStaked();

  // Staking rate - use the same approach as StakeBalanceCard
  const { data: stakeRewardContracts } = useStakeRewardContracts();
  const { data: stakeRewardsChartsInfoData, isLoading: stakeRateLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || []
  });
  const stakeHighestRateData = useHighestRateFromChartData(stakeRewardsChartsInfoData || []);

  // stUSDS data
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const userSuppliedUsds = stUsdsData?.userSuppliedUsds ?? 0n;

  // Morpho vault data
  const defaultMorphoVault = MORPHO_VAULTS[0];
  const morphoVaultAddress = defaultMorphoVault?.vaultAddress[mainnetChainId];
  const { data: morphoData, isLoading: morphoLoading } = useMorphoVaultOnChainData({
    vaultAddress: morphoVaultAddress
  });
  const { data: morphoRatesData, isLoading: morphoRatesLoading } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: MORPHO_VAULTS.map(v => v.vaultAddress[mainnetChainId])
  });

  // Combined Expert balance (stUSDS + Morpho)
  const morphoSupplied = morphoData?.userAssets ?? 0n;
  const totalExpertSupplied = userSuppliedUsds + morphoSupplied;

  // Calculate highest rate between stUSDS and all Morpho vaults
  // stUsdsRateDecimal and morphoMaxRateDecimal are decimals (e.g. 0.05 for 5%)
  const stUsdsRateDecimal = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) / 100 : 0;
  const morphoMaxRateDecimal = (morphoRatesData || []).reduce((max, rate) => Math.max(max, rate.netRate), 0);
  const maxExpertRate = Math.max(stUsdsRateDecimal, morphoMaxRateDecimal);

  // Visibility logic
  const hideRewards = Boolean(
    (totalUserRewardsSupplied === 0n && hideZeroBalances) ||
      (!showAllNetworks && !isMainnetId(currentChainId))
  );
  const hideSavings = Boolean(totalSavingsBalance === 0n && hideZeroBalances);
  const hideStake = Boolean(
    (totalUserStaked === 0n && hideZeroBalances) || (!showAllNetworks && !isMainnetId(currentChainId))
  );
  const hideExpert = Boolean(
    (totalExpertSupplied === 0n && hideZeroBalances) || (!showAllNetworks && !isMainnetId(currentChainId))
  );

  const isLoading =
    rewardsLoading ||
    savingsLoading ||
    stakeLoading ||
    stakeRateLoading ||
    stUsdsLoading ||
    morphoLoading ||
    morphoRatesLoading ||
    pricesLoading;
  const allHidden = hideRewards && hideSavings && hideStake && hideExpert;

  // Calculate USD values for sorting
  const calculateUsdValue = (amount: bigint, decimals: number, price: string | undefined): number => {
    if (!price || amount === 0n) return 0;
    return parseFloat(formatUnits(amount, decimals)) * parseFloat(price);
  };

  // Create sorted modules array based on USD value
  const sortedModules = useMemo(() => {
    const modules: Array<{
      id: 'rewards' | 'savings' | 'stusds' | 'staking';
      usdValue: number;
      hidden: boolean;
    }> = [
      {
        id: 'rewards',
        usdValue: calculateUsdValue(totalUserRewardsSupplied, 18, pricesData?.USDS?.price),
        hidden: hideRewards
      },
      {
        id: 'savings',
        usdValue: calculateUsdValue(totalSavingsBalance, 18, pricesData?.USDS?.price),
        hidden: hideSavings
      },
      {
        id: 'stusds',
        usdValue: calculateUsdValue(totalExpertSupplied, 18, pricesData?.USDS?.price),
        hidden: hideExpert
      },
      {
        id: 'staking',
        usdValue: calculateUsdValue(totalUserStaked ?? 0n, 18, pricesData?.SKY?.price),
        hidden: hideStake
      }
    ];

    return modules
      .filter(m => !m.hidden)
      .sort((a, b) => (b.usdValue - a.usdValue === 0 ? a.id.localeCompare(b.id) : b.usdValue - a.usdValue));
  }, [
    totalUserRewardsSupplied,
    totalSavingsBalance,
    totalExpertSupplied,
    totalUserStaked,
    pricesData,
    hideRewards,
    hideSavings,
    hideExpert,
    hideStake
  ]);

  if (allHidden && !isLoading) {
    return null;
  }

  // Render functions for each module type
  const renderRewardsRow = () => (
    <SuppliedFundsTableRow
      data={{
        tokenSymbol: 'USDS',
        moduleIcon: <img src={MODULE_ICONS['Rewards']} alt="Rewards" className="h-5 w-5" />,
        moduleName: 'Rewards',
        amount: totalUserRewardsSupplied,
        decimals: 18,
        usdPrice: pricesData?.USDS?.price,
        rateText: rewardsHighestRate ? formatDecimalPercentage(parseFloat(rewardsHighestRate.rate)) : '0%',
        ratePopoverType: 'str',
        isRateUpTo: true,
        chainId: mainnetChainId
      }}
      isLoading={rewardsLoading || usdsSkyChartLoading || usdsSpkChartLoading}
    />
  );

  const renderSavingsRow = () => (
    <SuppliedFundsSavingsRow
      totalBalance={totalSavingsBalance}
      balancesByNetwork={allNonZeroSavingsBalances}
      usdPrice={pricesData?.USDS?.price}
      rate={savingsRate > 0 ? formatDecimalPercentage(savingsRate) : '0%'}
      isLoading={savingsLoading || overallSkyDataLoading}
    />
  );

  const renderExpertRow = () => (
    <SuppliedFundsExpertRow
      totalBalance={totalExpertSupplied}
      balancesByProduct={[
        {
          productName: 'stUSDS',
          balance: userSuppliedUsds,
          rate: stUsdsRateDecimal > 0 ? formatDecimalPercentage(stUsdsRateDecimal) : undefined,
          isMorpho: false
        },
        {
          productName: 'Morpho USDS Vault',
          balance: morphoSupplied,
          rate:
            morphoRatesData?.[0]?.netRate != null && morphoRatesData[0].netRate > 0
              ? formatDecimalPercentage(morphoRatesData[0].netRate)
              : undefined,
          isMorpho: true
        }
      ]}
      usdPrice={pricesData?.USDS?.price}
      maxRate={maxExpertRate > 0 ? formatDecimalPercentage(maxExpertRate) : '0%'}
      isLoading={stUsdsLoading || morphoLoading || morphoRatesLoading}
    />
  );

  const renderStakingRow = () => (
    <SuppliedFundsTableRow
      data={{
        tokenSymbol: 'SKY',
        moduleIcon: (
          <img src={MODULE_ICONS['Staking Engine']} alt="Staking Engine" className="h-5 w-5" />
        ),
        moduleName: 'Staking Engine',
        amount: totalUserStaked ?? 0n,
        decimals: 18,
        usdPrice: pricesData?.SKY?.price,
        rateText: stakeHighestRateData?.rate
          ? formatDecimalPercentage(parseFloat(stakeHighestRateData.rate))
          : '0%',
        ratePopoverType: 'srr',
        isRateUpTo: true,
        chainId: mainnetChainId
      }}
      isLoading={stakeLoading || stakeRateLoading}
    />
  );

  const renderModule = (moduleId: 'rewards' | 'savings' | 'stusds' | 'staking') => {
    switch (moduleId) {
      case 'rewards':
        return renderRewardsRow();
      case 'savings':
        return renderSavingsRow();
      case 'stusds':
        return renderExpertRow();
      case 'staking':
        return renderStakingRow();
    }
  };

  return (
    <LoadingErrorWrapper
      isLoading={isLoading && allHidden}
      loadingComponent={<LoadingSuppliedFundsTable />}
      error={null}
      errorComponent={
        <Text variant="large" className="text-text text-center">
          <Trans>We could not load your supplied funds. Please try again later.</Trans>
        </Text>
      }
    >
      <div className="@container">
        <Table>
          <SuppliedFundsTableHeader />
          <TableBody>
            {sortedModules.map(module => (
              <Fragment key={module.id}>{renderModule(module.id)}</Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </LoadingErrorWrapper>
  );
}

function LoadingSuppliedFundsTable() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
