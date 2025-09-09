import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

export function StUSDSSuppliersCard() {
  const { i18n } = useLingui();
  const { data, isLoading, error } = useOverallSkyData();
  const suppliersCount = data && formatNumber(data.stusdsSuppliers);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={i18n._(msg`Suppliers`)}
      content={
        <Text variant="large" className="mt-2">
          {suppliersCount || 0}
        </Text>
      }
    />
  );
}
