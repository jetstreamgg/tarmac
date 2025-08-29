import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';

export function ExpertTvlCard(): React.ReactElement {
  const { data, isLoading, error } = useStUsdsData();

  // Currently only stUSDS TVL, will aggregate all expert modules TVL in the future
  const totalTvl = data?.totalAssets || 0n;

  return (
    <StatsCard
      title={t`Total TVL`}
      content={
        <Text className="mt-2" variant="large">
          {formatBigInt(totalTvl, { unit: 18 })} USDS
        </Text>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
