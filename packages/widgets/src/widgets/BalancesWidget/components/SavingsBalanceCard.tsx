import { useOverallSkyData, usePrices } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCardWithAccordion } from '@widgets/shared/components/ui/card/InteractiveStatsCardWithAccordion';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { ArrowRight } from 'lucide-react';
import { useChainId } from 'wagmi';

export const SavingsBalanceCard = ({
  urlMap,
  onExternalLinkClicked,
  savingsBalances,
  loading,
  variant = ModuleCardVariant.default
}: CardProps & { urlMap: Record<number, string> }) => {
  const { data: overallSkyData, isLoading: overallSkyDataLoading } = useOverallSkyData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();
  const chainId = useChainId();

  const totalSavingsBalance = savingsBalances?.reduce((acc, { balance }) => acc + balance, 0n);

  const skySavingsRate = parseFloat(overallSkyData?.skySavingsRatecRate ?? '0');

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCardWithAccordion
      title={t`Supplied to Savings`}
      icon={<img src="/images/savings_icon_large.svg" alt="Savings" className="h-full w-full" />}
      headerRightContent={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${totalSavingsBalance !== undefined ? formatBigInt(totalSavingsBalance) : '0'}`}</Text>
        )
      }
      footer={
        overallSkyDataLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : skySavingsRate > 0 ? (
          <div className="flex items-center gap-2">
            <RateLineWithArrow
              rateText={`Rate: ${formatDecimalPercentage(skySavingsRate)}`}
              popoverType="ssr"
              onExternalLinkClicked={onExternalLinkClicked}
              showArrow={false}
            />
            {urlMap[chainId] && (
              <ArrowRight
                size={16}
                className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100 group-hover/header-link:opacity-100"
              />
            )}
          </div>
        ) : (
          <></>
        )
      }
      footerRightContent={
        loading || pricesLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : totalSavingsBalance !== undefined && !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(
              parseFloat(formatUnits(totalSavingsBalance, 18)) * parseFloat(pricesData.USDS.price),
              {
                maxDecimals: 2
              }
            )}
          </Text>
        ) : undefined
      }
      balancesByChain={savingsBalances ?? []}
      urlMap={urlMap}
      pricesData={pricesData ?? {}}
      url={urlMap[chainId]}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Savings`}
      icon={<img src="/images/savings_icon_large.svg" alt="Savings" className="h-full w-full" />}
      url={urlMap[chainId]}
      logoName="savings"
      noChain={true}
      content={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${totalSavingsBalance !== undefined ? formatBigInt(totalSavingsBalance) : '0'}`} USDS</Text>
        )
      }
    />
  );
};
