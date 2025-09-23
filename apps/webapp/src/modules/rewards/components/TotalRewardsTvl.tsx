import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useTotalTvl } from '../hooks/useTotalTvl';
import { formatBigInt } from '@jetstreamgg/sky-utils';

export function TotalRewardsTvl() {
  const { data: totalTvl, isLoading, error } = useTotalTvl();

  return (
    <StatsCard
      title={t`Rewards Total Value Locked`}
      isLoading={isLoading}
      error={error}
      content={
        <Text className="mt-2" variant="large">
          {/* TODO make sure this will always be USDS */}
          {formatBigInt(totalTvl)} USDS
        </Text>
      }
    />
  );
}
