import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { PairTokenIcons } from '@jetstreamgg/sky-widgets';

export function SkySavingsRatePoolCard(): React.ReactElement {
  const { data, isLoading, error } = useOverallSkyData();
  const tvl = data && formatNumber(parseFloat(data.totalSavingsTvl));

  return (
    <StatsCard
      title={t`Sky Savings Rate Pool`}
      content={
        <div className="mt-2 flex items-center">
          <PairTokenIcons leftToken="USDS" rightToken="DAI" />
          <Text className="ml-2" variant="large">
            {tvl} USDS/DAI
          </Text>
        </div>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
