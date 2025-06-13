import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { PopoverInfo } from '@/modules/ui/components/PopoverInfo';

export function SavingsRateCard(): React.ReactElement {
  const { data, isLoading, error } = useOverallSkyData();

  return (
    <StatsCard
      title={t`Sky Savings Rate`}
      content={
        <div className="mt-2 flex flex-row items-center gap-2">
          <Text className="text-bullish" variant="large">
            {formatDecimalPercentage(parseFloat(data?.skySavingsRatecRate || '0'))}
          </Text>
          <PopoverInfo type="ssr" />
        </div>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
