import {
  useAvailableTokenRewardContracts,
  useRewardsChartInfo,
  TOKENS,
  usePrices,
  useHighestRateFromChartData,
  useRewardContractsToClaim
} from '@jetstreamgg/sky-hooks';
import {
  formatBigInt,
  formatDecimalPercentage,
  formatNumber,
  isMainnetId,
  chainId
} from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { useChainId, useAccount } from 'wagmi';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { UnclaimedRewards } from '@widgets/shared/components/ui/UnclaimedRewards';
import { calculateUnclaimedRewards } from '@widgets/shared/utils/calculateUnclaimedRewards';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';

export const RewardsBalanceCard = ({
  url,
  onExternalLinkClicked,
  loading,
  totalUserRewardsSupplied,
  variant = ModuleCardVariant.default
}: CardProps) => {
  const { address } = useAccount();
  const currentChainId = useChainId();
  // Use current chain if it's mainnet or tenderly, otherwise default to mainnet
  const rewardChainId = isMainnetId(currentChainId) ? currentChainId : chainId.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(rewardChainId);

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

  const rewardContractAddresses = rewardContracts
    .filter(c => c.supplyToken.symbol === TOKENS.usds.symbol)
    .map(c => c.contractAddress) as `0x${string}`[];

  const { data: unclaimedRewardsData, isLoading: unclaimedRewardsLoading } = useRewardContractsToClaim({
    rewardContractAddresses,
    addresses: address,
    chainId: rewardChainId,
    enabled: !!address
  });

  const { totalUnclaimedRewardsValue, uniqueRewardTokens } = calculateUnclaimedRewards(
    unclaimedRewardsData,
    pricesData,
    rewardChainId
  );

  const chartDataLoading = usdsSkyChartDataLoading || usdsSpkChartDataLoading;
  const mostRecentRateNumber = highestRateData ? parseFloat(highestRateData.rate) : null;

  return variant === ModuleCardVariant.default ? (
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
        <div className="flex flex-col gap-1">
          {chartDataLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : mostRecentRateNumber && mostRecentRateNumber > 0 ? (
            <RateLineWithArrow
              rateText={`Rates up to: ${mostRecentRateNumber ? formatDecimalPercentage(mostRecentRateNumber) : '0%'}`}
              popoverType="str"
              onExternalLinkClicked={onExternalLinkClicked}
            />
          ) : (
            <></>
          )}
          {uniqueRewardTokens.length > 0 && <UnclaimedRewards uniqueRewardTokens={uniqueRewardTokens} />}
        </div>
      }
      footerRightContent={
        loading || pricesLoading || unclaimedRewardsLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : (
          <div className="flex flex-col items-end gap-1">
            {totalUserRewardsSupplied !== undefined && !!pricesData?.USDS && (
              <Text variant="small" className="text-textSecondary leading-4">
                $
                {formatNumber(
                  parseFloat(formatUnits(totalUserRewardsSupplied, 18)) * parseFloat(pricesData.USDS.price),
                  {
                    maxDecimals: 2
                  }
                )}
              </Text>
            )}
            {totalUnclaimedRewardsValue > 0 && (
              <Text variant="small" className="text-textPrimary leading-4">
                ${formatNumber(totalUnclaimedRewardsValue, { maxDecimals: 2 })}
              </Text>
            )}
          </div>
        )
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`USDS supplied to Rewards`}
      tokenSymbol="USDS"
      url={url}
      logoName="rewards"
      content={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>
            {`${totalUserRewardsSupplied !== undefined ? formatBigInt(totalUserRewardsSupplied) : '0'}`} USDS
          </Text>
        )
      }
    />
  );
};
