import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  lsSkySpkRewardAddress,
  lsSkyUsdsRewardAddress,
  useHighestRateFromChartData,
  useRewardsChartInfo
} from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';

export function StakingRewardRateCard() {
  // Fetch chart data for both reward contracts
  const { data: lsSkyRewardsChartInfoData, isLoading: lsSkyUsdsChartDataLoading } = useRewardsChartInfo({
    rewardContractAddress: lsSkyUsdsRewardAddress[mainnet.id as keyof typeof lsSkyUsdsRewardAddress]
  });

  const { data: lsSpkRewardsChartInfoData, isLoading: lsSkySpkChartDataLoading } = useRewardsChartInfo({
    rewardContractAddress: lsSkySpkRewardAddress[mainnet.id as keyof typeof lsSkySpkRewardAddress]
  });

  // Find the highest rate
  const highestRateData = useHighestRateFromChartData([lsSkyRewardsChartInfoData, lsSpkRewardsChartInfoData]);
  const chartDataLoading = lsSkyUsdsChartDataLoading || lsSkySpkChartDataLoading;
  const highestRewardRate = highestRateData ? parseFloat(highestRateData.rate) : null;

  // Check if we have a valid rate (including 0)
  const hasValidRate = highestRewardRate != null && !isNaN(highestRewardRate);

  return (
    <StatsCard
      title={
        <HStack gap={1} className="items-center">
          <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
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
                <span className="text-textSecondary text-sm">{t`up to`}</span>{' '}
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
