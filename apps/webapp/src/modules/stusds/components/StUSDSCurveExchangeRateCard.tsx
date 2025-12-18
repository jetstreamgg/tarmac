import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useCurvePoolData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { CurveLogo } from '@/modules/icons/CurveLogo';

export function StUSDSCurveExchangeRateCard() {
  const { i18n } = useLingui();
  const { data: poolData, isLoading } = useCurvePoolData();

  // priceOracle is the USDS per stUSDS rate from Curve's EMA oracle (scaled by 1e18)
  const exchangeRate = poolData?.priceOracle || 0n;

  const formattedRate = exchangeRate > 0n ? formatBigInt(exchangeRate, { maxDecimals: 6 }) : '--';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={
        <div className="flex items-center gap-2">
          <span>{i18n._(msg`Curve Exchange Rate`)}</span>
          <CurveLogo className="h-3.5 w-3.5" />
        </div>
      }
      content={
        <div className="mt-2 flex items-center gap-1.5">
          <TokenIcon token={{ symbol: 'STUSDS', name: 'stusds' }} className="h-6 w-6" />
          <Text variant="large">1 stUSDS =</Text>
          <TokenIcon token={{ symbol: 'USDS', name: 'usds' }} className="h-6 w-6" />
          <Text variant="large">{formattedRate} USDS</Text>
        </div>
      }
    />
  );
}
