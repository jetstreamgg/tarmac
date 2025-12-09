import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

export function StUSDSNativeExchangeRateCard() {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading } = useStUsdsData();

  // assetPerShare is the USDS per stUSDS rate (scaled by 1e18)
  const exchangeRate = stUsdsData?.assetPerShare || 0n;

  const formattedRate = exchangeRate > 0n ? formatBigInt(exchangeRate, { maxDecimals: 6 }) : '--';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Exchange Rate`)}
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
