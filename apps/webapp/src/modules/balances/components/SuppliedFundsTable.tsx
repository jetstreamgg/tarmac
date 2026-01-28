import { Table, TableBody } from '@/components/ui/table';
import { SuppliedFundsTableHeader } from './SuppliedFundsTableHeader';
import { SuppliedFundsTableRow } from './SuppliedFundsTableRow';
import { SuppliedFundsSavingsRow } from './SuppliedFundsSavingsRow';
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
  useMorphoVaultData,
  useMorphoVaultCombinedData,
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
  const { data: morphoData, isLoading: morphoLoading } = useMorphoVaultData({
    vaultAddress: morphoVaultAddress
  });
  const { data: morphoCombinedData, isLoading: morphoRateLoading } = useMorphoVaultCombinedData({
    vaultAddress: morphoVaultAddress
  });

  // Combined Expert balance (stUSDS + Morpho)
  const morphoSupplied = morphoData?.userAssets ?? 0n;
  const totalExpertSupplied = userSuppliedUsds + morphoSupplied;

  // Calculate highest rate between stUSDS and Morpho
  const stUsdsRatePercent = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;
  const morphoRatePercent = morphoCombinedData?.rate.netRate ? morphoCombinedData.rate.netRate * 100 : 0;
  const maxExpertRate = Math.max(stUsdsRatePercent, morphoRatePercent);

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
    morphoRateLoading ||
    pricesLoading;
  const allHidden = hideRewards && hideSavings && hideStake && hideExpert;

  if (allHidden && !isLoading) {
    return null;
  }

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
            {/* Rewards Row */}
            {!hideRewards && (
              <SuppliedFundsTableRow
                data={{
                  tokenSymbol: 'USDS',
                  moduleIcon: <img src="/images/rewards_icon_large.svg" alt="Rewards" className="h-5 w-5" />,
                  moduleName: 'Rewards',
                  amount: totalUserRewardsSupplied,
                  decimals: 18,
                  usdPrice: pricesData?.USDS?.price,
                  rateText: rewardsHighestRate
                    ? formatDecimalPercentage(parseFloat(rewardsHighestRate.rate))
                    : '0%',
                  ratePopoverType: 'str',
                  isRateUpTo: true,
                  chainId: mainnetChainId
                }}
                isLoading={rewardsLoading || usdsSkyChartLoading || usdsSpkChartLoading}
              />
            )}

            {/* Savings Row */}
            {!hideSavings && (
              <SuppliedFundsSavingsRow
                totalBalance={totalSavingsBalance}
                balancesByNetwork={allNonZeroSavingsBalances}
                usdPrice={pricesData?.USDS?.price}
                rate={savingsRate > 0 ? formatDecimalPercentage(savingsRate) : '0%'}
                isLoading={savingsLoading || overallSkyDataLoading}
              />
            )}

            {/* Expert Row (stUSDS + Morpho) */}
            {!hideExpert && (
              <SuppliedFundsTableRow
                data={{
                  tokenSymbol: 'USDS',
                  moduleIcon: <img src="/images/expert_icon_large.svg" alt="Expert" className="h-5 w-5" />,
                  moduleName: 'Expert',
                  amount: totalExpertSupplied,
                  decimals: 18,
                  usdPrice: pricesData?.USDS?.price,
                  rateText: maxExpertRate > 0 ? `${maxExpertRate.toFixed(2)}%` : '0%',
                  ratePopoverType: 'expert',
                  isRateUpTo: true,
                  chainId: mainnetChainId
                }}
                isLoading={stUsdsLoading || morphoLoading || morphoRateLoading}
              />
            )}

            {/* Staking Row */}
            {!hideStake && (
              <SuppliedFundsTableRow
                data={{
                  tokenSymbol: 'SKY',
                  moduleIcon: (
                    <img
                      src="/images/staking_engine_icon_large.svg"
                      alt="Staking Engine"
                      className="h-5 w-5"
                    />
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
            )}
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
