import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

export function ExpertTvlCard(): React.ReactElement {
  const { data, isLoading, error } = useStUsdsData();

  // Currently only stUSDS TVL, will aggregate all expert modules TVL in the future
  const totalTvl = data?.totalAssets || 0n;

  return (
    <StatsCard
      title={t`Total TVL`}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(totalTvl, { unit: 18 })}
        />
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
