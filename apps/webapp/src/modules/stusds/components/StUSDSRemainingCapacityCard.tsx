import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsCapacityData, useStUsdsData } from '@jetstreamgg/sky-hooks';

export function StUSDSRemainingCapacityCard() {
  const { i18n } = useLingui();
  const { data: capacityData, isLoading: isLoadingCapacity } = useStUsdsCapacityData();
  const { data: stUsdsData, isLoading: isLoadingStUsds } = useStUsdsData();

  const maxCapacity = capacityData?.maxCapacity || 0n;
  const totalAssets = stUsdsData?.totalAssets || 0n;
  const remainingCapacity = maxCapacity > totalAssets ? maxCapacity - totalAssets : 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoadingCapacity || isLoadingStUsds}
      title={i18n._(msg`Remaining capacity`)}
      content={
        <Text variant="large" className="mt-2">
          {formatBigInt(remainingCapacity, { unit: 18 })} USDS
        </Text>
      }
    />
  );
}
