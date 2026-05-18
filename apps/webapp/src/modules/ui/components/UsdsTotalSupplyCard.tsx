import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useUsdsDaiData } from '@/hooks';
import { PairTokenIcons } from '@/widgets';
import { Text } from '@/modules/layout/components/Typography';

export function UsdsTotalSupplyCard(): React.ReactElement {
  const { data, isLoading, error } = useUsdsDaiData({ limit: 1 });
  const totalSupply =
    data &&
    data[0] &&
    parseFloat(data[0].total).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

  return (
    <StatsCard
      title={t`Total supply`}
      content={
        <div className="mt-2 flex items-center">
          <PairTokenIcons leftToken="USDS" rightToken="DAI" noChain />
          <Text className="ml-2" variant="large">
            {totalSupply || '0'}
          </Text>
        </div>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
