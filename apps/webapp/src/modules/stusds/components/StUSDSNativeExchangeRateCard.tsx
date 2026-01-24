import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData, useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PopoverInfo, getTooltipById } from '@jetstreamgg/sky-widgets';

export function StUSDSNativeExchangeRateCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading: isDataLoading } = useStUsdsData();
  const { data: capacityData, isLoading: isCapacityLoading } = useStUsdsCapacityData();

  // assetPerShare is the USDS per stUSDS rate (scaled by 1e18)
  const exchangeRate = stUsdsData?.assetPerShare || 0n;
  const availableLiquidityBuffered = stUsdsData?.availableLiquidityBuffered || 0n;
  const remainingCapacityBuffered = capacityData?.remainingCapacityBuffered || 0n;

  const isLiquidityExhausted = !isDataLoading && stUsdsData != null && availableLiquidityBuffered === 0n;
  const isSupplyCapacityReached =
    !isCapacityLoading && capacityData != null && remainingCapacityBuffered === 0n;

  const isBothDisabled = isLiquidityExhausted && isSupplyCapacityReached;
  const hasAnyRestriction = isLiquidityExhausted || isSupplyCapacityReached;

  const formattedRate = exchangeRate > 0n ? formatBigInt(exchangeRate, { maxDecimals: 6 }) : '--';

  const tooltipContent = getTooltipById('native-exchange-rate');
  const liquidityTooltipContent = getTooltipById('liquidity-temporarily-utilized');
  const capacityTooltipContent = getTooltipById('supply-capacity-reached');
  const bothDisabledTooltipContent = getTooltipById('native-route-temporarily-unavailable');

  const getStatusLabel = () => {
    if (isBothDisabled) {
      return i18n._(msg`Native route temporarily unavailable`);
    }
    if (isLiquidityExhausted) {
      return i18n._(msg`Liquidity temporarily utilized`);
    }
    if (isSupplyCapacityReached) {
      return i18n._(msg`Capacity temporarily full`);
    }
    return null;
  };

  const getStatusTooltip = () => {
    if (isBothDisabled) {
      return bothDisabledTooltipContent;
    }
    if (isLiquidityExhausted) {
      return liquidityTooltipContent;
    }
    if (isSupplyCapacityReached) {
      return capacityTooltipContent;
    }
    return null;
  };

  const statusLabel = getStatusLabel();
  const statusTooltip = getStatusTooltip();

  return (
    <StatsCard
      className="h-full"
      isLoading={isDataLoading || isCapacityLoading}
      title={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-1">
            <span>{i18n._(msg`Native Exchange Rate`)}</span>
            {!hasAnyRestriction && (
              <PopoverInfo
                title={i18n._(msg`${tooltipContent?.title || 'Native Exchange Rate'}`)}
                description={i18n._(msg`${tooltipContent?.tooltip || ''}`)}
                iconClassName="text-textSecondary hover:text-white transition-colors"
                iconSize="medium"
              />
            )}
          </div>
          {hasAnyRestriction && statusLabel && statusTooltip && (
            <div className="flex items-center gap-1">
              <Text variant="small" className="text-white">
                {statusLabel}
              </Text>
              <PopoverInfo
                title={i18n._(msg`${statusTooltip?.title || statusLabel}`)}
                description={i18n._(msg`${statusTooltip?.tooltip || ''}`)}
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
