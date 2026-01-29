import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

type StUSDSSuppliersCardProps = {
  title?: React.ReactNode;
};

export function StUSDSSuppliersCard({ title }: StUSDSSuppliersCardProps = {}): React.ReactElement {
  const { data, isLoading, error } = useOverallSkyData();
  const suppliersCount = data && formatNumber(data.stusdsSuppliers);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={title ?? <Trans>Suppliers</Trans>}
      content={
        <Text variant="large" className="mt-2">
          {suppliersCount || 0}
        </Text>
      }
    />
  );
}
