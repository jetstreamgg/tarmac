import {
  usePrices,
  useHighestRateFromChartData,
  useStakeRewardContracts,
  useMultipleRewardsChartInfo,
  useAllStakeUrnAddresses,
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

export const StakeBalanceCard = ({
  loading,
  stakeBalance,
  url,
  onExternalLinkClicked,
  variant = ModuleCardVariant.default
}: CardProps) => {
  const currentChainId = useChainId();
  const { address } = useAccount();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Use current chain if it's mainnet or tenderly, otherwise default to mainnet
  const stakeChainId = isMainnetId(currentChainId) ? currentChainId : chainId.mainnet;

  const { data: stakeRewardContracts } = useStakeRewardContracts();
  const { data: stakeRewardsChartsInfoData } = useMultipleRewardsChartInfo({
    rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || []
  });

  const stakeContractAddresses = (stakeRewardContracts?.map(c => c.contractAddress) as `0x${string}`[]) || [];

  const { data: urnAddresses } = useAllStakeUrnAddresses(address);

  const { data: allUnclaimedRewardsData } = useRewardContractsToClaim({
    rewardContractAddresses: stakeContractAddresses,
    addresses: urnAddresses,
    chainId: stakeChainId,
    enabled: urnAddresses.length > 0 && stakeContractAddresses.length > 0
  });

  const highestRateData = useHighestRateFromChartData(stakeRewardsChartsInfoData || []);

  // Only count contracts that have actual rate data > 0
  const contractsWithRates = (stakeRewardsChartsInfoData || []).filter(chartData => {
    if (!chartData || chartData.length === 0) return false;
    const mostRecent = chartData.sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
    return parseFloat(mostRecent?.rate || '0') > 0;
  });
  const hasMultipleRates = contractsWithRates.length > 1;

  const totalStakedValue =
    stakeBalance && pricesData?.SKY
      ? parseFloat(formatUnits(stakeBalance, 18)) * parseFloat(pricesData.SKY.price)
      : 0;

  const { totalUnclaimedRewardsValue, uniqueRewardTokens } = calculateUnclaimedRewards(
    allUnclaimedRewardsData,
    pricesData,
    stakeChainId
  );

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Staking Engine`}
      icon={<img src="/images/staking_engine_icon_large.svg" alt="Staking Engine" className="h-full w-full" />}
      headerRightContent={
        loading || pricesLoading ? (
          <Skeleton className="w-32" />
        ) : stakeBalance !== undefined && !!pricesData?.SKY ? (
          <Text>
            $
            {formatNumber(totalStakedValue, {
              maxDecimals: 2
            })}
          </Text>
        ) : (
          <Text>$0</Text>
        )
      }
      footer={
        <div className="flex flex-col gap-1">
          <RateLineWithArrow
            rateText={
              hasMultipleRates
                ? `Rates up to: ${formatDecimalPercentage(parseFloat(highestRateData?.rate || '0'))}`
                : `Rate: ${formatDecimalPercentage(parseFloat(highestRateData?.rate || '0'))}`
            }
            popoverType="srr"
            onExternalLinkClicked={onExternalLinkClicked}
          />
          {uniqueRewardTokens.length > 0 && <UnclaimedRewards uniqueRewardTokens={uniqueRewardTokens} />}
        </div>
      }
      footerRightContent={
        totalUnclaimedRewardsValue > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-4" />
            <Text variant="small" className="text-textPrimary leading-4">
              ${formatNumber(totalUnclaimedRewardsValue, { maxDecimals: 2 })}
            </Text>
          </div>
        ) : undefined
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Staking Engine`}
      url={url}
      logoName="staking"
      content={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${stakeBalance ? formatBigInt(stakeBalance) : '0'}`} SKY</Text>
        )
      }
    />
  );
};
