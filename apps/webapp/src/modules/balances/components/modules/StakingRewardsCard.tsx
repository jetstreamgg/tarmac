import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { mainnet } from 'viem/chains';
import { Text } from '@/modules/layout/components/Typography';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage, isL2ChainId } from '@jetstreamgg/sky-utils';
import {
  lsSkySpkRewardAddress,
  lsSkyUsdsRewardAddress,
  useHighestRateFromChartData,
  useRewardsChartInfo
} from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export function StakingRewardsCard() {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

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
  const mostRecentRateNumber = highestRateData ? parseFloat(highestRateData.rate) : null;

  return (
    <ModuleCard
      intent={Intent.STAKE_INTENT}
      module={t`Staking`}
      title={t`Access Staking rewards (or Borrow) with SKY`}
      subHeading={
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <HStack gap={2}>
            <PairTokenIcons leftToken="SKY" rightToken="USDS" chainId={mainnet.id} />
            <Text className="text-textSecondary">With: SKY Get: USDS</Text>
          </HStack>
          <HStack gap={2}>
            <PairTokenIcons leftToken="SKY" rightToken="SPK" chainId={mainnet.id} />
            <Text className="text-textSecondary">With: SKY Get: SPK</Text>
          </HStack>
        </div>
      }
      emphasisText={
        chartDataLoading ? (
          <Skeleton className="h-12 w-80" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rates <span className="text-lg">up to</span>{' '}
            {mostRecentRateNumber ? formatDecimalPercentage(mostRecentRateNumber) : '0%'}
            <PopoverRateInfo type="str" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
      className="from-[#3b2795] to-[#7231e3]"
      notAvailable={isL2}
      logoName="staking"
    />
  );
}
