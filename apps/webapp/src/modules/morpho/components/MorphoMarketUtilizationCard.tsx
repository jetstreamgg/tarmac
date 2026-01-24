import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { UtilizationBar } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';
import { MorphoMarketAllocation } from '@jetstreamgg/sky-hooks';

type MorphoMarketUtilizationCardProps = {
  market?: MorphoMarketAllocation;
  isLoading: boolean;
  error?: Error;
};

export function MorphoMarketUtilizationCard({ market, isLoading, error }: MorphoMarketUtilizationCardProps) {
  const { i18n } = useLingui();

  // Convert from 0-1 decimal to 0-100 percentage
  const utilizationRate = (market?.utilization ?? 0) * 100;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={i18n._(msg`Utilization`)}
      content={
        <div className="mt-2 flex items-center gap-2">
          <Text variant="large">{utilizationRate.toFixed(1)}%</Text>
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
