import {
  usePrices,
  useHighestRateFromChartData,
  useRewardsChartInfo,
  lsSkyUsdsRewardAddress,
  lsSkySpkRewardAddress
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { mainnet } from 'viem/chains';

export const StakeBalanceCard = ({ loading, stakeBalance, url, onExternalLinkClicked }: CardProps) => {
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Fetch chart data for both reward contracts
  const { data: lsSkyRewardsChartInfoData } = useRewardsChartInfo({
    rewardContractAddress: lsSkyUsdsRewardAddress[mainnet.id as keyof typeof lsSkyUsdsRewardAddress]
  });

  const { data: lsSpkRewardsChartInfoData } = useRewardsChartInfo({
    rewardContractAddress: lsSkySpkRewardAddress[mainnet.id as keyof typeof lsSkySpkRewardAddress]
  });

  // Find the highest rate
  const highestRateData = useHighestRateFromChartData([lsSkyRewardsChartInfoData, lsSpkRewardsChartInfoData]);

  const totalStakedValue =
    stakeBalance && pricesData?.SKY
      ? parseFloat(formatUnits(stakeBalance, 18)) * parseFloat(pricesData.SKY.price)
      : 0;

  return (
    <InteractiveStatsCard
      title={t`SKY supplied to Stake & Borrow`}
      iconSrc="/images/staking_engine_icon_large.svg"
      headerRightContent={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${stakeBalance ? formatBigInt(stakeBalance) : '0'}`}</Text>
        )
      }
      footer={
        <div className="z-[99999] flex w-fit items-center gap-1.5">
          <Text variant="small" className="text-bullish leading-4">
            {`Rates up to: ${formatDecimalPercentage(parseFloat(highestRateData?.rate || '0'))}`}
          </Text>
          <PopoverRateInfo
            type="srr"
            onExternalLinkClicked={onExternalLinkClicked}
            iconClassName="h-[13px] w-[13px]"
          />
        </div>
      }
      footerRightContent={
        loading || pricesLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : stakeBalance !== undefined && !!pricesData?.SKY ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(totalStakedValue, {
              maxDecimals: 2
            })}
          </Text>
        ) : undefined
      }
      url={url}
    />
  );
};
