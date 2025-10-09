import { useOverallSkyData, usePrices } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCardWithAccordion } from '@widgets/shared/components/ui/card/InteractiveStatsCardWithAccordion';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';

export const SavingsBalanceCard = ({
  urlMap,
  onExternalLinkClicked,
  savingsBalances,
  loading
}: CardProps & { urlMap: Record<number, string> }) => {
  const { data: overallSkyData, isLoading: overallSkyDataLoading } = useOverallSkyData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const totalSavingsBalance = savingsBalances?.reduce((acc, { balance }) => acc + balance, 0n);

  const skySavingsRate = parseFloat(overallSkyData?.skySavingsRatecRate ?? '0');

  return (
    <InteractiveStatsCardWithAccordion
      title={t`USDS supplied to Savings`}
      tokenSymbol="sUSDS"
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
          <div className="flex w-fit items-center gap-1.5">
            <Text variant="small" className="text-bullish leading-4">
              {`Rate: ${formatDecimalPercentage(skySavingsRate)}`}
            </Text>
            <PopoverRateInfo
              type="ssr"
              onExternalLinkClicked={onExternalLinkClicked}
              iconClassName="h-[13px] w-[13px]"
            />
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
    />
  );
};
