import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSTvlCard() {
  const { i18n } = useLingui();

  // TODO: Replace with real stUSDS data when hooks are available
  const mockTvl = 1800000000n * 10n ** 18n; // 1.8B USDS
  const isLoading = false;

  return (
    <StatsCard
      isLoading={isLoading}
      title={i18n._(msg`Total Value Locked`)}
      content={
        <Text variant="large" className="mt-2">
          {formatBigInt(mockTvl, { unit: 18, compact: true })} USDS
        </Text>
      }
    />
  );
}
