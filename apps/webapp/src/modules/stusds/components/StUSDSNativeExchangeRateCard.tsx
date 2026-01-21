import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PopoverInfo, getTooltipById } from '@jetstreamgg/sky-widgets';

export function StUSDSNativeExchangeRateCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading } = useStUsdsData();

  // assetPerShare is the USDS per stUSDS rate (scaled by 1e18)
  const exchangeRate = stUsdsData?.assetPerShare || 0n;
  const availableLiquidityBuffered = stUsdsData?.availableLiquidityBuffered || 0n;
  const isLiquidityExhausted = !isLoading && availableLiquidityBuffered === 0n;

  const formattedRate = exchangeRate > 0n ? formatBigInt(exchangeRate, { maxDecimals: 6 }) : '--';

  const tooltipContent = getTooltipById('native-exchange-rate');
  const liquidityTooltipContent = getTooltipById('liquidity-temporarily-utilized');

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-1">
            <span>{i18n._(msg`Native Exchange Rate`)}</span>
            {!isLiquidityExhausted && (
              <PopoverInfo
                title={i18n._(msg`${tooltipContent?.title || 'Native Exchange Rate'}`)}
                description={i18n._(msg`${tooltipContent?.tooltip || ''}`)}
                iconClassName="text-textSecondary hover:text-white transition-colors"
                iconSize="medium"
              />
            )}
          </div>
          {isLiquidityExhausted && (
            <div className="flex items-center gap-1">
              <Text variant="small" className="text-white">
                {i18n._(msg`Liquidity temporarily utilized`)}
              </Text>
              <PopoverInfo
                title={i18n._(msg`${liquidityTooltipContent?.title || 'Liquidity temporarily utilized'}`)}
                description={i18n._(msg`${liquidityTooltipContent?.tooltip || ''}`)}
                iconClassName="text-amber-400 hover:text-amber-300 transition-colors"
                iconSize="medium"
              />
            </div>
          )}
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
