import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { StatsCard } from '@/modules/ui/components/StatsCard';

type PendleMarketInfoCardProps = {
  market: PendleMarketConfig;
};

export const PendleMarketInfoCard = ({ market }: PendleMarketInfoCardProps) => {
  const { data: allMarketsData, isLoading, error } = usePendleMarketsApiData();
  const data = allMarketsData?.[market.marketAddress];

  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <StatsCard
          title={t`Fixed APY`}
          isLoading={isLoading}
          error={error}
          content={
            <Text className="text-bullish mt-2" variant="large">
              {data?.impliedApy !== undefined ? formatDecimalPercentage(data.impliedApy) : '—'}
            </Text>
          }
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <StatsCard
          title={<Trans>TVL</Trans>}
          isLoading={isLoading}
          error={error}
          content={
            <Text className="mt-2" variant="large">
              {data?.formattedTvl ?? '—'}
            </Text>
          }
        />
      </div>
    </div>
  );
};
