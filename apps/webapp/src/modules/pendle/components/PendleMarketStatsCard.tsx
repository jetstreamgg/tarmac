import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { isMarketMatured, usePendleMarketsApiData, type PendleMarketConfig } from '@jetstreamgg/sky-hooks';

const secondsToExpiry = (expiry: number): number => Math.max(0, expiry - Math.floor(Date.now() / 1000));
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type PendleMarketStatsCardProps = {
  market: PendleMarketConfig;
  onClick?: () => void;
  disabled?: boolean;
};

const formatDays = (seconds: number): string => {
  const days = Math.max(0, Math.round(seconds / 86_400));
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
};

export const PendleMarketStatsCard = ({ market, onClick, disabled = false }: PendleMarketStatsCardProps) => {
  const matured = isMarketMatured(market.expiry);
  const remaining = secondsToExpiry(market.expiry);
  const { data: allMarketsData, isLoading } = usePendleMarketsApiData();
  const marketData = allMarketsData?.[market.marketAddress];

  return (
    <Card
      className={`from-card to-card h-full bg-transparent bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${
        onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid="pendle-market-stats-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'USDS' }} />
          <Text>PT-{market.underlyingSymbol}</Text>
          {matured ? (
            <Text variant="small" className="text-textSecondary">
              <Trans>· matured</Trans>
            </Text>
          ) : (
            <Text variant="small" className="text-textSecondary">
              <Trans>· {formatDays(remaining)} left</Trans>
            </Text>
          )}
        </HStack>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : marketData?.impliedApy !== undefined ? (
          <Text className="text-bullish">{formatDecimalPercentage(marketData.impliedApy)}</Text>
        ) : (
          <Text>—</Text>
        )}
      </CardHeader>
      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          <VStack className="items-stretch justify-between" gap={2}>
            <Text className="text-textSecondary text-sm leading-4 whitespace-nowrap">
              <Trans>Underlying APY</Trans>
            </Text>
            {isLoading ? (
              <Skeleton className="h-4 w-21" />
            ) : marketData?.underlyingApy !== undefined ? (
              <Text>{formatDecimalPercentage(marketData.underlyingApy)}</Text>
            ) : (
              <Text>—</Text>
            )}
          </VStack>
          <VStack className="items-stretch justify-between text-right" gap={2}>
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>TVL</Trans>
            </Text>
            {isLoading ? (
              <div className="flex justify-end">
                <Skeleton className="h-4 w-30" />
              </div>
            ) : marketData?.formattedTvl ? (
              <Text>{marketData.formattedTvl}</Text>
            ) : (
              <Text>—</Text>
            )}
          </VStack>
          <VStack className="items-stretch justify-between text-right" gap={2}>
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>Maturity</Trans>
            </Text>
            <Text className="whitespace-nowrap">
              {new Date(market.expiry * 1000).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </VStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
