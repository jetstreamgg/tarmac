import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useMorphoVaultSupplierAddresses } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

type MorphoVaultSuppliersCardProps = {
  vaultAddress: `0x${string}`;
  title?: React.ReactElement | string;
};

export function MorphoVaultSuppliersCard({
  vaultAddress,
  title
}: MorphoVaultSuppliersCardProps): React.ReactElement {
  const { data, isLoading, error } = useMorphoVaultSupplierAddresses({ vaultAddress });
  const suppliersCount = data && formatNumber(data.length);

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
