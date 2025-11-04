import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { UtilizationBar, PopoverInfo, getTooltipById } from '@jetstreamgg/sky-widgets';
import { useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSUtilizationCard() {
  const { i18n } = useLingui();
  const { data: capacityData, isLoading } = useStUsdsCapacityData();

  const utilizationRate = capacityData?.utilizationRate ?? 0;

  // const utilizationColor =
  //   utilizationRate > 90 ? 'text-error' : utilizationRate > 75 ? 'text-orange-400' : '';
  const utilizationColor = '';
  const tooltipContent = getTooltipById('utilization');

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Utilization`)}</span>
          <PopoverInfo
            title={i18n._(msg`${tooltipContent?.title || 'Utilization'}`)}
            description={i18n._(msg`${tooltipContent?.tooltip || ''}`)}
            iconClassName="text-textSecondary hover:text-white transition-colors"
            iconSize="medium"
          />
        </div>
      }
      content={
        <div className="mt-2 flex items-center gap-2">
          <Text className={utilizationColor} variant="large">
            {utilizationRate.toFixed(1)}%
          </Text>
          <UtilizationBar
            utilizationRate={utilizationRate}
            isLoading={isLoading}
            showLabel={false}
            barHeight="h-2"
          />
        </div>
      }
    />
  );
}
