import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';

export function StUSDSLiquidityCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading: isStUsdsLoading } = useStUsdsData();

  const availableLiquidity = stUsdsData?.availableLiquidityBuffered ?? 0n;

  return (
    <StatsCard
      className="h-full"
      isLoading={isStUsdsLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Available liquidity`)}</span>
          <PopoverInfo type="stusdsLiquidity" />
        </div>
      }
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(availableLiquidity)}
        />
      }
    />
  );
}
