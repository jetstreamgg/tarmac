import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useCollateralData } from '@jetstreamgg/sky-hooks';
import { getIlkName } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

export function TotalDebtCard() {
  const { i18n } = useLingui();
  const { data: collateralData, isLoading: isCollateralLoading } = useCollateralData(getIlkName(2));
  const totalStakingDebt = collateralData?.totalDaiDebt ?? 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isCollateralLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Total Staking Engine debt`)}</span>
          <PopoverInfo type="totalStakingDebt" />
        </div>
      }
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(totalStakingDebt)}
        />
      }
    />
  );
}
