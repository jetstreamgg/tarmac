import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useTotalTvl } from '../hooks/useTotalTvl';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

export function TotalRewardsTvl() {
  const { data: totalTvl, isLoading, error } = useTotalTvl();

  return (
    <StatsCard
      title={t`Total TVL`}
      isLoading={isLoading}
      error={error}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(totalTvl)}
        />
      }
    />
  );
}
