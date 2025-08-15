import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { useCollateralData } from '@jetstreamgg/sky-hooks';
import { getIlkName } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

export function StUSDSLiquidityCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading: isStUsdsLoading } = useStUsdsData();

  const { data: collateralData, isLoading: isCollateralLoading } = useCollateralData(getIlkName(2));
  const totalStakingDebt = collateralData?.totalDaiDebt ?? 0n;

  const totalAssets = stUsdsData?.totalAssets ?? 0n;
  const availableLiquidity = totalAssets > totalStakingDebt ? totalAssets - totalStakingDebt : 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isStUsdsLoading || isCollateralLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Available liquidity`)}</span>
          <PopoverInfo type="stusdsLiquidity" />
        </div>
      }
      content={
        <div className="mt-2">
          <Text variant="large">{formatBigInt(availableLiquidity)} USDS</Text>
        </div>
      }
    />
  );
}
