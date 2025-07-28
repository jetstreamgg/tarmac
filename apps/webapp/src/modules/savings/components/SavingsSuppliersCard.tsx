import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

export function SavingsSuppliersCard(): React.ReactElement {
  const { data, isLoading, error } = useOverallSkyData();
  const ssrSuppliers = data && formatNumber(data.ssrSuppliers);

  return (
    <StatsCard
      title={t`Savings Suppliers`}
      content={
        <Text className="mt-2" variant="large">
          {ssrSuppliers || 0}
        </Text>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
