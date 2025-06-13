import {
  useAvailableTokenRewardContracts,
  useRewardsChartInfo,
  TOKENS,
  usePrices
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';
import { useChainId } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';

export const RewardsBalanceCard = ({
  url,
  onExternalLinkClicked,
  loading,
  usdsSkySuppliedBalance,
  usdsCleSuppliedBalance
}: CardProps) => {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? 314310 : 1; //TODO: update once we add non-mainnet rewards
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  const usdsSkyRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.sky.symbol
  );

  const { data: chartData, isLoading: chartDataLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSkyRewardContract?.contractAddress as string
  });

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const sortedChartData = chartData ? [...chartData].sort((a, b) => b.blockTimestamp - a.blockTimestamp) : [];
  const mostRecentRate = sortedChartData.length > 0 ? sortedChartData[0].rate : null;
  const mostRecentRateNumber = mostRecentRate ? parseFloat(mostRecentRate) : null;

  return (
    <InteractiveStatsCard
      title={t`USDS supplied to Rewards`}
      tokenSymbol="USDS"
      headerRightContent={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>
            {`${
              usdsSkySuppliedBalance !== undefined && usdsCleSuppliedBalance !== undefined
                ? formatBigInt(usdsSkySuppliedBalance + usdsCleSuppliedBalance)
                : '0'
            }`}
          </Text>
        )
      }
      footer={
        chartDataLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : mostRecentRateNumber && mostRecentRateNumber > 0 ? (
          <div className="flex w-fit items-center gap-1.5">
            <Text variant="small" className="text-bullish leading-4">
              {`Rates up to: ${mostRecentRateNumber ? formatDecimalPercentage(mostRecentRateNumber) : '0%'}`}
            </Text>
            <PopoverRateInfo
              type="str"
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
        ) : usdsSkySuppliedBalance !== undefined &&
          usdsCleSuppliedBalance !== undefined &&
          !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(
              parseFloat(formatUnits(usdsSkySuppliedBalance + usdsCleSuppliedBalance, 18)) *
                parseFloat(pricesData.USDS.price),
              {
                maxDecimals: 2
              }
            )}
          </Text>
        ) : undefined
      }
      url={url}
    />
  );
};
