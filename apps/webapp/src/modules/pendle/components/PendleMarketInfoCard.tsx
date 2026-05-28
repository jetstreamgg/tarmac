import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatDecimalPercentage } from '@/utils';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { Text } from '@/modules/layout/components/Typography';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { PopoverRateInfo } from '@/widgets';

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
            <div className="mt-2 flex flex-row items-center gap-2">
              <Text className="text-bullish" variant="large">
                {data?.impliedApy !== undefined ? formatDecimalPercentage(data.impliedApy) : '—'}
              </Text>
              {data?.impliedApy !== undefined && <PopoverRateInfo type="fixedYield" />}
            </div>
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
