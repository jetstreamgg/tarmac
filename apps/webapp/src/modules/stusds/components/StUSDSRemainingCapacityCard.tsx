import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

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
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(remainingCapacityBuffered, { unit: 18 })}
        />
      }
    />
  );
}
