import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useStakeRewardContracts
} from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';

export function StakingRewardRateCard() {
  // Fetch chart data for all stake reward contracts
  const { data: stakeRewardContracts, isLoading: stakeRewardsContractsLoading } = useStakeRewardContracts();
  const { data: stakeRewardsChartsInfoData, isLoading: stakeRewardsChartsDataLoading } =
    useMultipleRewardsChartInfo({
      rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || []
    });

  // Find the highest rate
  const highestRateData = useHighestRateFromChartData(stakeRewardsChartsInfoData || []);
  const chartDataLoading = stakeRewardsContractsLoading || stakeRewardsChartsDataLoading;
  const highestRewardRate = highestRateData ? parseFloat(highestRateData.rate) : null;

  // Check if we have a valid rate (including 0)
  const hasValidRate = highestRewardRate != null && !isNaN(highestRewardRate);

  // Only count contracts that have actual rate data > 0
  const contractsWithRates = (stakeRewardsChartsInfoData || []).filter(chartData => {
    if (!chartData || chartData.length === 0) return false;
    const mostRecent = chartData.reduce((latest, current) =>
      current.blockTimestamp > latest.blockTimestamp ? current : latest
    );
    return parseFloat(mostRecent?.rate || '0') > 0;
  });
  const hasMultipleRates = contractsWithRates.length > 1;

  return (
    <StatsCard
      title={
        <HStack gap={1} className="items-center">
          <Heading tag="h3" className="text-textSecondary text-sm leading-tight font-normal">
            <Trans>Staking Reward Rate</Trans>
          </Heading>
          <PopoverRateInfo type="srr" />
        </HStack>
      }
      isLoading={chartDataLoading}
      content={
        <div className="mt-2 flex items-center gap-1">
          <Text className="text-bullish">
            {hasValidRate ? (
              <>
                {hasMultipleRates && <span className="text-textSecondary text-sm">{t`up to`} </span>}
                {formatDecimalPercentage(highestRewardRate)}
              </>
            ) : (
              'N/A'
            )}
          </Text>
        </div>
      }
    />
  );
}
