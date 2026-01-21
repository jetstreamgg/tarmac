import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Text } from '@widgets/shared/components/ui/Typography';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import {
  useRewardContractInfo,
  useRewardContractTokens,
  useRewardsChartInfo,
  useStakeHistoricData
} from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { Card } from '@widgets/components/ui/card';
import { formatEther } from 'viem';
import { cn } from '@widgets/lib/utils';

export const StakeRewardsCardCompact = ({
  contractAddress,
  urnSelectedRewardContract,
  handleCardClick
}: {
  contractAddress: `0x${string}`;
  urnSelectedRewardContract?: `0x${string}`;
  handleCardClick?: (contractAddress: `0x${string}`) => void;
}) => {
  const chainId = useChainId();
  const {
    data: rewardContractInfo,
    isLoading: isRewardContractInfoLoading,
    error: rewardContractInfoError
  } = useRewardContractInfo({
    rewardContractAddress: contractAddress,
    chainId
  });

  const {
    data: rewardContractTokens,
    isLoading: isRewardContractTokensLoading,
    error: rewardContractTokensError
  } = useRewardContractTokens(contractAddress);

  const { data: rewardsChartInfoData, isLoading: isRewardsChartInfoLoading } = useRewardsChartInfo({
    rewardContractAddress: contractAddress
  });

  const mostRecentRewardsChartInfoData = useMemo(
    () => rewardsChartInfoData?.slice().sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0],
    [rewardsChartInfoData]
  );

  const {
    data: stakeHistoricData,
    isLoading: stakeHistoricIsLoading,
    error: stakeHistoricError
  } = useStakeHistoricData();
  const mostRecentStakeData = useMemo(
    () =>
      stakeHistoricData?.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0],
    [stakeHistoricData]
  );

  const skyPrice = mostRecentStakeData?.skyPrice ? Number(mostRecentStakeData.skyPrice) : 0;

  const totalSuppliedInDollars =
    rewardContractInfo && skyPrice && !isNaN(skyPrice)
      ? +formatEther(rewardContractInfo.totalSupplied) * skyPrice
      : undefined;
  const isTvlLoading = isRewardContractInfoLoading || stakeHistoricIsLoading;
  const tvlError = rewardContractInfoError || stakeHistoricError;

  const isRewardContractSelected = contractAddress.toLowerCase() === urnSelectedRewardContract?.toLowerCase();

  return (
    <Card
      className={cn(
        'flex items-center justify-between bg-radial-(--gradient-position) transition-colors',
        isRewardContractSelected
          ? 'from-primary-start/100 to-primary-end/100 cursor-default'
          : 'from-card to-card hover:from-primary-start/40 hover:to-primary-end/40 cursor-pointer'
      )}
      aria-selected={isRewardContractSelected}
      onClick={() => {
        if (!isRewardContractSelected) {
          handleCardClick?.(contractAddress);
        }
      }}
    >
      <MotionHStack className="items-center gap-3 space-x-0" variants={positionAnimations}>
        {rewardContractTokens ? (
          <TokenIcon token={rewardContractTokens.rewardsToken} className="h-8 w-8" />
        ) : isRewardContractTokensLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-6 rounded-full" />
        ) : rewardContractTokensError ? (
          <Warning boxSize={16} viewBox="0 0 16 16" />
        ) : null}
        <div className="flex flex-col items-start">
          {rewardContractTokens ? (
            <Text>{rewardContractTokens.rewardsToken.symbol}</Text>
          ) : isRewardContractTokensLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-10" />
          ) : null}
          {mostRecentRewardsChartInfoData ? (
            <Text className="text-textSecondary text-sm">
              {mostRecentRewardsChartInfoData.suppliers} suppliers
            </Text>
          ) : isRewardsChartInfoLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-10" />
          ) : mostRecentRewardsChartInfoData ? (
            <Warning boxSize={16} viewBox="0 0 16 16" />
          ) : null}
        </div>
      </MotionHStack>
      <div className="flex flex-col items-end">
        {mostRecentRewardsChartInfoData && parseFloat(mostRecentRewardsChartInfoData.rate) > 0 ? (
          <div className="flex items-center gap-2">
            <Text className="text-bullish">
              {formatDecimalPercentage(parseFloat(mostRecentRewardsChartInfoData.rate))} Rate
            </Text>
          </div>
        ) : isRewardsChartInfoLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-10" />
        ) : (
          ''
        )}
        {totalSuppliedInDollars ? (
          <Text className="text-textSecondary text-sm">
            ${formatNumber(totalSuppliedInDollars, { maxDecimals: 0 })} TVL
          </Text>
        ) : isTvlLoading ? (
          <Skeleton className="bg-textSecondary h-5 w-28" />
        ) : tvlError ? (
          <Warning boxSize={16} viewBox="0 0 16 16" />
        ) : null}
      </div>
    </Card>
  );
};
