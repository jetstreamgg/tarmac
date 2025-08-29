import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';

export function StUSDSSuppliersCard() {
  const { i18n } = useLingui();

  const suppliersCount = 'TODO';

  return (
    <StatsCard
      className="h-full"
      isLoading={false}
      title={i18n._(msg`Suppliers`)}
      content={
        <Text variant="large" className="mt-2">
          {suppliersCount}
        </Text>
      }
    />
  );
}
