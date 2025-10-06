import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

export function StUSDSRemainingCapacityCard() {
  const { i18n } = useLingui();
  const { data: capacityData, isLoading: isLoadingCapacity } = useStUsdsCapacityData();

  const remainingCapacityBuffered = capacityData?.remainingCapacityBuffered || 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoadingCapacity}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Remaining capacity`)}</span>
          <PopoverInfo type="remainingCapacity" />
        </div>
      }
      content={
        <Text variant="large" className="mt-2">
          {formatBigInt(remainingCapacityBuffered, { unit: 18 })} USDS
        </Text>
      }
    />
  );
}
