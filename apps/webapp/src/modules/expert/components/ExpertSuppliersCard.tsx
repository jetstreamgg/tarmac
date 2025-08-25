import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';

export function ExpertSuppliersCard(): React.ReactElement {
  // TODO: Implement actual expert suppliers data fetching

  return (
    <StatsCard
      title={t`Expert Suppliers`}
      content={
        <Text className="mt-2" variant="large">
          TODO
        </Text>
      }
      isLoading={false}
    />
  );
}
