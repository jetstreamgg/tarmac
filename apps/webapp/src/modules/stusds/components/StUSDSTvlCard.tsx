import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';

export function StUSDSTvlCard() {
  const { i18n } = useLingui();
  const { data, isLoading } = useStUsdsData();

  const totalAssets = data?.totalAssets || 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Total Value Locked`)}
      content={
        <Text variant="large" className="mt-2">
          {formatBigInt(totalAssets, { unit: 18 })} USDS
        </Text>
      }
    />
  );
}
