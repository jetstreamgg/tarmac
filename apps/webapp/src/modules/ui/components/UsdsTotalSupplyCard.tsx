import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useUsdsDaiData } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from './TokenIconWithBalance';

export function UsdsTotalSupplyCard(): React.ReactElement {
  const { data, isLoading, error } = useUsdsDaiData({ limit: 1 });
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
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={usdsTotalSupply || '0'}
        />
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
