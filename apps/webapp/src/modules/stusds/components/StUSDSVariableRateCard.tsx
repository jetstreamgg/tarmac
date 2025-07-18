import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSVariableRateCard() {
  const { i18n } = useLingui();

  // TODO: Replace with real stUSDS data when hooks are available
  const mockYieldMin = 5.2;
  const mockYieldMax = 6.7;
  const isLoading = false;

  return (
    <StatsCard
      isLoading={isLoading}
      title={i18n._(msg`Variable Yield`)}
      content={
        <div className="mt-2">
          <Text variant="large">{`${mockYieldMin}% – ${mockYieldMax}%`}</Text>
          <Text className="text-muted-foreground" variant="small">
            (variable)
          </Text>
        </div>
      }
    />
  );
}
