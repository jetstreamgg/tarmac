import {
  useAvailableTokenRewardContracts,
  useRewardsChartInfo,
  TOKENS,
  usePrices,
  useHighestRateFromChartData
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
  totalUserRewardsSupplied
}: CardProps) => {
  const currentChainId = useChainId();
  const chainId = isTestnetId(currentChainId) ? 314310 : 1; //TODO: update once we add non-mainnet rewards
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  const usdsSkyRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.sky.symbol
  );

  const usdsSpkRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.spk.symbol
  );

  // Fetch chart data for both reward contracts
  const { data: usdsSkyChartData, isLoading: usdsSkyChartDataLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSkyRewardContract?.contractAddress as string,
    limit: 1
  });

  const { data: usdsSpkChartData, isLoading: usdsSpkChartDataLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSpkRewardContract?.contractAddress as string,
    limit: 1
  });

  // Find the highest rate from both contracts
  const highestRateData = useHighestRateFromChartData([usdsSkyChartData, usdsSpkChartData]);

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const chartDataLoading = usdsSkyChartDataLoading || usdsSpkChartDataLoading;
  const mostRecentRateNumber = highestRateData ? parseFloat(highestRateData.rate) : null;

  return (
    <InteractiveStatsCard
      title={t`USDS supplied to Rewards`}
      tokenSymbol="USDS"
      headerRightContent={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>
            {`${totalUserRewardsSupplied !== undefined ? formatBigInt(totalUserRewardsSupplied) : '0'}`}
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
        ) : totalUserRewardsSupplied !== undefined && !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(
              parseFloat(formatUnits(totalUserRewardsSupplied, 18)) * parseFloat(pricesData.USDS.price),
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
