import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSUtilizationCard() {
  const { i18n } = useLingui();

  // TODO: Replace with real stUSDS data when hooks are available
  const mockUtilization = 87;
  const isLoading = false;
  const isHighUtilization = mockUtilization > 90;

  return (
    <StatsCard
      isLoading={isLoading}
      title={i18n._(msg`Utilization`)}
      content={
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Text className={isHighUtilization ? 'text-error' : ''} variant="large">
              {mockUtilization}%
            </Text>
          </div>
          <div className="mt-2 w-full">
            <div className="bg-secondary h-[5px] overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-300 ${
                  mockUtilization > 90
                    ? 'bg-error'
                    : mockUtilization > 75
                      ? 'bg-orange-400'
                      : 'bg-textSecondary'
                }`}
                style={{ width: `${Math.min(mockUtilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      }
    />
  );
}
