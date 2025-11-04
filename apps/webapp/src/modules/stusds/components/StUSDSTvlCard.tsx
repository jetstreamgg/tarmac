import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

export function StUSDSTvlCard() {
  const { i18n } = useLingui();
  const { data, isLoading } = useStUsdsData();

  const totalAssets = data?.totalAssets || 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Total Value Locked`)}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(totalAssets, { unit: 18 })}
        />
      }
    />
  );
}
