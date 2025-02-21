import { useAccount, useChainId } from 'wagmi';
import {
  useAvailableTokenRewardContracts,
  useRewardsChartInfo,
  useRewardsSuppliedBalance,
  TOKENS,
  usePrices
} from '@jetstreamgg/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';

export const RewardsBalanceCard = ({ onClick, onExternalLinkClicked }: CardProps) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  const usdsSkyRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.sky.symbol
  );
  const usdsCleRewardContract = rewardContracts.find(
    f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === TOKENS.cle.symbol
  );

  const {
    data: usdsSkySuppliedBalance,
    isLoading: usdsSkySuppliedBalanceLoading,
    error: usdsSkySuppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId,
    address,
    contractAddress: usdsSkyRewardContract?.contractAddress as `0x${string}`
  });

  const {
    data: usdsCleSuppliedBalance,
    isLoading: usdsCleSuppliedBalanceIsLoading,
    error: usdsCleSuppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId,
    address,
    contractAddress: usdsCleRewardContract?.contractAddress as `0x${string}`
  });

  const {
    data: chartData,
    isLoading: chartDataLoading,
    error: chartDataError
  } = useRewardsChartInfo({
    rewardContractAddress: usdsSkyRewardContract?.contractAddress as string,
    limit: 1
  });

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const mostRecentRate = chartData && chartData.length > 0 ? chartData[0].rate : null;
  const mostRecentRateNumber = mostRecentRate ? parseFloat(mostRecentRate) : null;

  if (usdsSkySuppliedBalanceError || usdsCleSuppliedBalanceError || chartDataError) return null;

  return (
    <InteractiveStatsCard
      title={t`USDS supplied to Rewards`}
      tokenSymbol="USDS"
      headerRightContent={
        usdsSkySuppliedBalanceLoading || usdsCleSuppliedBalanceIsLoading ? (
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
        usdsSkySuppliedBalanceLoading || usdsCleSuppliedBalanceIsLoading || pricesLoading ? (
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
      onClick={onClick}
    />
  );
};
