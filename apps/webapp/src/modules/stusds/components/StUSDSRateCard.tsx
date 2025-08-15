import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatYsrAsApy } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

export function StUSDSRateCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading } = useStUsdsData();

  const moduleRate = stUsdsData?.moduleRate || 0n;
  const formattedRate = moduleRate > 0n ? formatYsrAsApy(moduleRate) : '0.00%';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Rate`)}
      content={
        <div className="mt-2 flex items-center gap-1.5">
          <Text variant="large" className="text-bullish">
            {formattedRate}
          </Text>
          <PopoverInfo type="stusds" />
        </div>
      }
    />
  );
}
