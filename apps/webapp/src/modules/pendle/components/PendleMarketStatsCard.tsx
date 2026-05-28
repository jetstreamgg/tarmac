import { Trans } from '@lingui/react/macro';
import { formatDecimalPercentage } from '@/utils';
import { isMarketMatured, usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeLeft } from '../utils/formatTimeLeft';
import { getTooltipById, PopoverInfo, PopoverRateInfo } from '@/widgets';

const secondsToExpiry = (expiry: number): number => Math.max(0, expiry - Math.floor(Date.now() / 1000));

type PendleMarketStatsCardProps = {
  market: PendleMarketConfig;
  onClick?: () => void;
  disabled?: boolean;
};

export const PendleMarketStatsCard = ({ market, onClick, disabled = false }: PendleMarketStatsCardProps) => {
  const matured = isMarketMatured(market.expiry);
  const remaining = secondsToExpiry(market.expiry);
  const { data: allMarketsData, isLoading } = usePendleMarketsApiData();
  const marketData = allMarketsData?.[market.marketAddress];
  const maturityTooltip = getTooltipById('maturity-date');

  return (
    <Card
      className={`from-card to-card h-full bg-transparent bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${
        onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid="pendle-market-stats-card"
    >
      <CardHeader className="flex flex-row items-center space-y-0">
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: `PT-${market.underlyingSymbol}` }} />
          {matured ? (
            <Text className="text-textSecondary">
              <Trans>Matured</Trans>
            </Text>
          ) : isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : marketData?.impliedApy !== undefined ? (
            <>
              <Text>
                Fixed <span className="text-bullish">{formatDecimalPercentage(marketData.impliedApy)}</span>{' '}
                APY for {formatTimeLeft(remaining)}
              </Text>
              <PopoverRateInfo type="fixedYield" iconClassName="w-3 h-3" />
            </>
          ) : (
            <Text>—</Text>
          )}
        </HStack>
      </CardHeader>
      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          <VStack className="items-stretch justify-between" gap={2}>
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>TVL</Trans>
            </Text>
            {isLoading ? (
              <Skeleton className="h-4 w-30" />
            ) : marketData?.formattedTvl ? (
              <Text>{marketData.formattedTvl}</Text>
            ) : (
              <Text>—</Text>
            )}
          </VStack>
          <VStack className="items-stretch justify-between text-right" gap={2}>
            <HStack className="items-center justify-end" gap={1}>
              <Text className="text-textSecondary text-sm leading-4">
                <Trans>Maturity</Trans>
              </Text>
              {maturityTooltip && (
                <PopoverInfo
                  title={maturityTooltip.title}
                  description={maturityTooltip.tooltip}
                  iconClassName="text-textSecondary hover:text-white transition-colors"
                />
              )}
            </HStack>
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
