import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useUniqueExpertSuppliers } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

export function ExpertSuppliersCard(): React.ReactElement {
  const { data, isLoading, error } = useUniqueExpertSuppliers();
  const suppliersCount = data && formatNumber(data.uniqueCount);

  return (
    <StatsCard
      title={t`Expert suppliers`}
      content={
        <Text className="mt-2" variant="large">
          {suppliersCount || 0}
        </Text>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
