import { useSavingsData, useOverallSkyData, usePrices } from '@jetstreamgg/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/utils';
import { Text } from '@/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCardWithAccordion } from '@/shared/components/ui/card/InteractiveStatsCardWithAccordion';
import { Skeleton } from '@/components/ui/skeleton';
import { PopoverRateInfo } from '@/shared/components/ui/PopoverRateInfo';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';
import { useMultiChainSavingsBalances } from '@jetstreamgg/hooks';

export const SavingsBalanceCard = ({
  urlMap,
  onExternalLinkClicked,
  chainIds
}: CardProps & { urlMap: Record<number, string> }) => {
  const { data: savingsData, isLoading: savingsDataLoading, error: savingsDataError } = useSavingsData();
  const {
    data: overallSkyData,
    isLoading: overallSkyDataLoading,
    error: overallSkyDataError
  } = useOverallSkyData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const { data: multichainSavingsBalances, isLoading: multichainSavingsBalancesLoading } =
    useMultiChainSavingsBalances({ chainIds });

  const sortedSavingsBalances = Object.entries(multichainSavingsBalances ?? {})
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
    .map(([chainId, balance]) => ({
      chainId: Number(chainId),
      balance
    }));

  const totalSavingsBalance = sortedSavingsBalances.reduce((acc, { balance }) => acc + balance, 0n);

  const skySavingsRate = parseFloat(overallSkyData?.skySavingsRatecRate ?? '0');

  if (savingsDataError || overallSkyDataError) return null;

  return (
    <InteractiveStatsCardWithAccordion
      title={t`Savings balance`}
      tokenSymbol="USDS"
      headerRightContent={
        savingsDataLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${savingsData ? formatBigInt(totalSavingsBalance) : '0'}`}</Text>
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
        multichainSavingsBalancesLoading || pricesLoading ? (
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
      balancesByChain={sortedSavingsBalances}
      urlMap={urlMap}
    />
  );
};
