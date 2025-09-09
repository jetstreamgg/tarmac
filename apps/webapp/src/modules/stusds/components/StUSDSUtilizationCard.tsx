import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg, t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { UtilizationBar, PopoverInfo } from '@jetstreamgg/sky-widgets';
import { useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSUtilizationCard() {
  const { i18n } = useLingui();
  const { data: capacityData, isLoading } = useStUsdsCapacityData();

  const utilizationRate = capacityData?.utilizationRate ?? 0;

  const utilizationColor =
    utilizationRate > 90 ? 'text-error' : utilizationRate > 75 ? 'text-orange-400' : '';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Utilization`)}</span>
          <PopoverInfo
            title={t`Vault Utilization`}
            description={t`The percentage of vault capacity currently in use. High utilization may limit deposits and withdrawals. When utilization exceeds 90%, the vault approaches its operational limits.`}
            iconClassName="text-textSecondary hover:text-white transition-colors"
            width={14}
            height={14}
          />
        </div>
      }
      content={
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-2">
            <Text className={utilizationColor} variant="large">
              {utilizationRate.toFixed(1)}%
            </Text>
          </div>
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
