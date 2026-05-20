import { useMemo } from 'react';
import {
  getPendleMarketByAddress,
  isMarketMatured,
  useAllPendleUserAssets,
  usePendleMarketsApiData
} from '@/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@/utils';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCardAlt } from '@/widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import {
  InteractiveStatsCardWithMarketAccordion,
  MarketBalanceForAccordion
} from '@/widgets/shared/components/ui/card/InteractiveStatsCardWithMarketAccordion';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@/widgets/shared/components/ui/RateLineWithArrow';

export const FixedYieldBalanceCard = ({
  url,
  loading,
  variant = ModuleCardVariant.default,
  hideZeroBalances = false
}: CardProps & { hideZeroBalances?: boolean }) => {
  const { data: assetsData, isLoading: assetsLoading } = useAllPendleUserAssets();
  const { data: marketsApi, isLoading: ratesLoading } = usePendleMarketsApiData();

  const { total, totalUsd, markets } = assetsData;

  // Highest implied APY across markets the user actually holds (skip matured ones)
  // plus a count of those active markets so we can switch between "Rate" and
  // "Rates up to" labelling.
  const { maxRate, activeMarketsCount } = markets.reduce(
    (acc, m) => {
      const config = getPendleMarketByAddress(m.marketAddress);
      if (!config || isMarketMatured(config.expiry)) return acc;
      const rate = marketsApi?.[m.marketAddress]?.impliedApy ?? 0;
      return {
        maxRate: rate > acc.maxRate ? rate : acc.maxRate,
        activeMarketsCount: acc.activeMarketsCount + 1
      };
    },
    { maxRate: 0, activeMarketsCount: 0 }
  );

  const isBalanceLoading = loading || assetsLoading;
  const isRateLoading = loading || assetsLoading || ratesLoading;

  const fixedYieldIcon = (
    <img src="/images/pendle_icon_large.svg" alt="Fixed Yield" className="h-full w-full" />
  );

  // Build per-market accordion rows + per-market URLs.
  const { marketBalances, urlMap } = useMemo(() => {
    const balances: MarketBalanceForAccordion[] = markets.flatMap(m => {
      const config = getPendleMarketByAddress(m.marketAddress);
      if (!config) return [];
      const matured = isMarketMatured(config.expiry);
      // Matured markets are only worth showing if the user still holds PT to redeem.
      if (matured && m.ptBalance <= 0n) return [];
      return [
        {
          marketName: config.name,
          marketAddress: m.marketAddress,
          balance: m.ptBalance,
          balanceNormalized: m.ptBalanceNormalized,
          tokenIconSymbol: `PT-${config.underlyingSymbol}`,
          balanceDecimals: config.underlyingDecimals,
          valuationUsd: m.valuationUsd,
          rate: matured ? undefined : marketsApi?.[m.marketAddress]?.impliedApy,
          isMatured: matured
        }
      ];
    });

    const filtered = hideZeroBalances ? balances.filter(b => b.balance > 0n) : balances;

    // Sort by normalized balance descending so the biggest position shows first.
    const sorted = filtered.sort((a, b) =>
      b.balanceNormalized > a.balanceNormalized ? 1 : b.balanceNormalized < a.balanceNormalized ? -1 : 0
    );

    // Matured markets aren't valid deep-link targets (the widget rejects them),
    // so fall back to the base Fixed Yield URL for those rows.
    const map: Record<string, string> = {};
    sorted.forEach(b => {
      if (!url) {
        map[b.marketAddress] = '';
        return;
      }
      if (b.isMatured) {
        map[b.marketAddress] = url;
        return;
      }
      const separator = url.includes('?') ? '&' : '?';
      map[b.marketAddress] = `${url}${separator}fixed_module=market&market=${b.marketAddress}`;
    });

    return { marketBalances: sorted, urlMap: map };
  }, [markets, marketsApi, hideZeroBalances, url]);

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCardWithMarketAccordion
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      headerRightContent={
        isBalanceLoading ? <Skeleton className="w-32" /> : <Text>{formatBigInt(total)}</Text>
      }
      footer={
        isRateLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : maxRate > 0 ? (
          <RateLineWithArrow
            rateText={
              activeMarketsCount === 1
                ? t`Rate: ${formatDecimalPercentage(maxRate)}`
                : t`Rates up to: ${formatDecimalPercentage(maxRate)}`
            }
            popoverType="fixedYield"
            showArrow={false}
          />
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
      marketBalances={marketBalances}
      urlMap={urlMap}
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      url={url}
      logoName="fixedYield"
      content={isBalanceLoading ? <Skeleton className="w-32" /> : <Text>{formatBigInt(total)}</Text>}
    />
  );
};
