import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';

export function StUSDSCapCard() {
  const { i18n } = useLingui();
  const { data: capacityData, isLoading } = useStUsdsCapacityData();

  const maxCapacity = capacityData?.maxCapacity || 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Maximum capacity`)}
      content={
        <Text variant="large" className="mt-2">
          {formatBigInt(maxCapacity, { unit: 18 })} USDS
        </Text>
      }
    />
  );
}
