import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useCurveRate } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { CurveLogo } from '@/modules/icons/CurveLogo';
import { PopoverInfo, getTooltipById } from '@jetstreamgg/sky-widgets';

export function StUSDSCurveExchangeRateCard() {
  const { i18n } = useLingui();
  const { curveRate, isLoading } = useCurveRate();

  // curveRate is the current USDS per stUSDS exchange rate from the pool (scaled by 1e18)
  const exchangeRate = curveRate || 0n;

  const formattedRate = exchangeRate > 0n ? formatBigInt(exchangeRate, { maxDecimals: 6 }) : '--';

  const tooltipContent = getTooltipById('curve-exchange-rate');

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Curve Exchange Rate`)}</span>
          <PopoverInfo
            title={i18n._(msg`${tooltipContent?.title || 'Curve Exchange Rate'}`)}
            description={i18n._(msg`${tooltipContent?.tooltip || ''}`)}
            iconClassName="text-textSecondary hover:text-white transition-colors"
            iconSize="medium"
          />
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
