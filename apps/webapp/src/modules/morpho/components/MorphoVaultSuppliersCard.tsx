import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useMorphoVaultSupplierAddresses } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';

type MorphoVaultSuppliersCardProps = {
  vaultAddress: `0x${string}`;
  title?: string;
};

export function MorphoVaultSuppliersCard({ vaultAddress, title }: MorphoVaultSuppliersCardProps) {
  const { i18n } = useLingui();
  const { data, isLoading, error } = useMorphoVaultSupplierAddresses({ vaultAddress });
  const suppliersCount = data && formatNumber(data.length);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={title ?? i18n._(msg`Suppliers`)}
      content={
        <Text variant="large" className="mt-2">
          {suppliersCount || 0}
        </Text>
      }
    />
  );
}
