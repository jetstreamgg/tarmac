import { useAllPendleUserAssets, usePendleMarketsApiData } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { CardProps, ModuleCardVariant } from './ModulesBalances';

export const FixedYieldBalanceCard = ({
  url,
  loading,
  variant = ModuleCardVariant.default
}: CardProps & { hideZeroBalances?: boolean }) => {
  const { data: assetsData, isLoading: assetsLoading } = useAllPendleUserAssets();
  const { data: marketsApi, isLoading: ratesLoading } = usePendleMarketsApiData();

  const { total, totalUsd, markets } = assetsData;

  // Highest implied APY across markets the user actually holds.
  const maxRate = markets.reduce((max, m) => {
    const rate = marketsApi?.[m.marketAddress]?.impliedApy ?? 0;
    return rate > max ? rate : max;
  }, 0);

  const isBalanceLoading = loading || assetsLoading;
  const isRateLoading = loading || assetsLoading || ratesLoading;

  const fixedYieldIcon = (
    <img src="/images/pendle_icon_large.svg" alt="Fixed Yield" className="h-full w-full" />
  );

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      headerRightContent={
        isBalanceLoading ? <Skeleton className="w-32" /> : <Text>{formatBigInt(total)}</Text>
      }
      footer={
        isRateLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : maxRate > 0 ? (
          <Text variant="small" className="text-bullish">
            {t`Rates up to: ${formatDecimalPercentage(maxRate)}`}
          </Text>
        ) : (
          <></>
        )
      }
      footerRightContent={
        isBalanceLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : totalUsd > 0 ? (
          <Text variant="small" className="text-textSecondary">
            ${formatNumber(totalUsd, { maxDecimals: 2 })}
          </Text>
        ) : undefined
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      url={url}
      logoName="fixedYield"
      content={
        isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>${formatNumber(totalUsd, { maxDecimals: 2 })}</Text>
        )
      }
    />
  );
};
