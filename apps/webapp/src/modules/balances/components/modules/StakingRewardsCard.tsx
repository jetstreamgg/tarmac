import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { mainnet } from 'viem/chains';
import { Text } from '@/modules/layout/components/Typography';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage, isL2ChainId } from '@jetstreamgg/sky-utils';
import {
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useStakeRewardContracts
} from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export function StakingRewardsCard() {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

  // Fetch chart data for all stake reward contracts
  const { data: stakeRewardContracts, isLoading: stakeRewardsContractsLoading } = useStakeRewardContracts();
  const { data: stakeRewardsChartsInfoData, isLoading: stakeRewardsChartsDataLoading } =
    useMultipleRewardsChartInfo({
      rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || []
    });

  // Find the highest rate
  const highestRateData = useHighestRateFromChartData(stakeRewardsChartsInfoData || []);
  const chartDataLoading = stakeRewardsContractsLoading || stakeRewardsChartsDataLoading;
  const mostRecentRateNumber = highestRateData ? parseFloat(highestRateData.rate) : null;

  return (
    <ModuleCard
      intent={Intent.STAKE_INTENT}
      module={t`Staking`}
      title={t`Access Staking rewards (or Borrow) with SKY`}
      subHeading={
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <HStack gap={2}>
            <PairTokenIcons leftToken="SKY" rightToken="SKY" chainId={mainnet.id} />
            <Text className="text-textSecondary">With: SKY Get: SKY</Text>
          </HStack>
          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start lg:flex-row lg:items-center">
            <HStack gap={2}>
              <PairTokenIcons leftToken="SKY" rightToken="SPK" chainId={mainnet.id} />
              <Text className="text-textSecondary">With: SKY Get: SPK</Text>
            </HStack>
            <Text variant="small" className="rounded-full bg-[#504DFF] px-2 py-1 text-white">
              <Trans>SPK rewards ending soon</Trans>
            </Text>
          </div>
        </div>
      }
      emphasisText={
        chartDataLoading ? (
          <Skeleton className="h-12 w-80" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rates <span className="text-lg">up to</span>{' '}
            {mostRecentRateNumber ? formatDecimalPercentage(mostRecentRateNumber) : '0%'}
            <PopoverRateInfo type="srr" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
      className="from-[#3b2795] to-[#7231e3]"
      notAvailable={isL2}
      logoName="staking"
    />
  );
}
