import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useCollateralData } from '@jetstreamgg/sky-hooks';
import { getIlkName } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

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
          <span>{i18n._(msg`Total staking engine debt`)}</span>
          <PopoverInfo type="totalStakingDebt" />
        </div>
      }
      content={
        <div className="mt-2">
          <Text variant="large">{formatBigInt(totalStakingDebt)} USDS</Text>
        </div>
      }
    />
  );
}
