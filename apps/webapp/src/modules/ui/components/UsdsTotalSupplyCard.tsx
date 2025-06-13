import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useUsdsDaiData } from '@jetstreamgg/sky-hooks';

export function UsdsTotalSupplyCard(): React.ReactElement {
  const { data, isLoading, error } = useUsdsDaiData();
  const usdsTotalSupply =
    data &&
    data[0] &&
    parseFloat(data[0].totalUsds).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

  return (
    <StatsCard
      title={t`Total supply of USDS`}
      content={
        <Text className="mt-2" variant="large">
          {usdsTotalSupply} USDS
        </Text>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
