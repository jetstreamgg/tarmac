import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';

export function SavingsCard() {
  const { data: overallSkyData, isLoading: overallSkyDataLoading } = useOverallSkyData();
  const skySavingsRate = parseFloat(overallSkyData?.skySavingsRatecRate ?? '0');

  return (
    <ModuleCard
      intent={Intent.SAVINGS_INTENT}
      module={t`Savings`}
      title={t`Access the Sky Savings Rate`}
      className="from-[#462696] to-[#952de5]"
      logoName="savings"
      subHeading={
        <HStack gap={2}>
          <PairTokenIcons leftToken="USDS" rightToken="USDS" />
          <Text className="text-textSecondary">With: USDS Get: USDS</Text>
        </HStack>
      }
      emphasisText={
        overallSkyDataLoading ? (
          <Skeleton className="h-10.5 w-48" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rate {skySavingsRate ? formatDecimalPercentage(skySavingsRate) : '0%'}
            <PopoverRateInfo type="ssr" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
    />
  );
}
