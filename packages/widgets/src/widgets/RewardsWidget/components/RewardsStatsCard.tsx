import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import {
  RewardContract,
  useRewardContractInfo,
  useRewardsChartInfo,
  useRewardsSuppliedBalance,
  useRewardsRewardsBalance,
  useUserRewardsBalance,
  TOKENS,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { RewardsStatsCardCore } from './RewardsStatsCardCore';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useConnection, useChainId } from 'wagmi';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';

export const RewardsStatsCard = ({
  rewardContract,
  onClick,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: {
  rewardContract: RewardContract;
  onClick: (rewardContract: RewardContract) => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { address } = useConnection();
  const chainId = useChainId();

  const { data, isLoading, error } = useRewardContractInfo({
    chainId: rewardContract.chainId,
    rewardContractAddress: rewardContract.contractAddress
  });

  const {
    data: chartData,
    isLoading: isLoadingChart,
    error: errorChart
  } = useRewardsChartInfo({
    rewardContractAddress: rewardContract.contractAddress,
    limit: 1
  });

  // User's supplied balance
  const {
    data: suppliedBalance,
    isLoading: suppliedBalanceLoading,
    error: suppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId,
    address,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  // User's unclaimed rewards
  const {
    data: rewardsBalance,
    isLoading: rewardsBalanceLoading,
    error: rewardsBalanceError
  } = useRewardsRewardsBalance({
    chainId,
    address,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  const {
    data: pointsData,
    isLoading: pointsLoading,
    error: pointsError
  } = useUserRewardsBalance({
    chainId,
    address: (address || ZERO_ADDRESS) as `0x${string}`,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  // Check if user has a balance to determine which stats to show
  const hasUserBalance = suppliedBalance && suppliedBalance > 0n;
  const shouldShowPoints = rewardContract.rewardToken.symbol === TOKENS.cle.symbol;
  const formattedPoints = formatNumber(parseFloat(pointsData?.rewardBalance || '0'), {
    compact: true,
    maxDecimals: 2
  });

  return (
    <RewardsStatsCardCore
      rewardContract={rewardContract}
      onClick={onClick}
      isConnectedAndEnabled={isConnectedAndEnabled}
      className="from-card to-card hover:from-primary-start/100 hover:to-primary-end/100 active:from-primary-start/100 active:to-primary-end/100 bg-radial-(--gradient-position) transition-[background-color,background-image,opacity]"
      content={
        <HStack className="mt-5 justify-between" gap={2}>
          <MotionVStack className="justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">
              {hasUserBalance ? t`Supplied Balance` : t`TVL`}
            </Text>
            {hasUserBalance ? (
              // Show user's supplied balance
              suppliedBalance ? (
                <Text>
                  {formatBigInt(suppliedBalance, { maxDecimals: 0 })} {rewardContract.supplyToken.symbol}
                </Text>
              ) : suppliedBalanceLoading ? (
                <Skeleton className="bg-textSecondary h-5 w-10" />
              ) : suppliedBalanceError ? (
                <Warning boxSize={16} viewBox="0 0 16 16" />
              ) : (
                <Text>0 {rewardContract.supplyToken.symbol}</Text>
              )
            ) : // Show TVL for non-user contracts
            data ? (
              <Text>{formatBigInt(data?.totalSupplied, { maxDecimals: 0 })} USDS</Text>
            ) : isLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : error ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
          <MotionVStack className="items-end justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">
              {hasUserBalance ? t`Accumulated Rewards` : t`Suppliers`}
            </Text>
            {hasUserBalance ? (
              shouldShowPoints ? (
                pointsData ? (
                  <HStack className="items-center" gap={1}>
                    <TokenIcon token={rewardContract.rewardToken} width={16} className="h-4 w-4" />
                    <Text>
                      {formattedPoints} {rewardContract.rewardToken.symbol} Points
                    </Text>
                  </HStack>
                ) : pointsLoading ? (
                  <Skeleton className="bg-textSecondary h-5 w-10" />
                ) : pointsError ? (
                  <Warning boxSize={16} viewBox="0 0 16 16" />
                ) : (
                  <HStack className="items-center" gap={1}>
                    <TokenIcon token={rewardContract.rewardToken} width={16} className="h-4 w-4" />
                    <Text>0 {rewardContract.rewardToken.symbol}</Text>
                  </HStack>
                )
              ) : rewardsBalance !== undefined ? (
                <HStack className="items-center" gap={1}>
                  <TokenIcon token={rewardContract.rewardToken} width={16} className="h-4 w-4" />
                  <Text>
                    {formatBigInt(rewardsBalance, {
                      compact: rewardContract.rewardToken.symbol === TOKENS.cle.symbol,
                      maxDecimals: 2
                    })}{' '}
                    {rewardContract.rewardToken.symbol}
                  </Text>
                </HStack>
              ) : rewardsBalanceLoading ? (
                <Skeleton className="bg-textSecondary h-5 w-10" />
              ) : rewardsBalanceError ? (
                <Warning boxSize={16} viewBox="0 0 16 16" />
              ) : (
                <HStack className="items-center" gap={1}>
                  <TokenIcon token={rewardContract.rewardToken} width={16} className="h-4 w-4" />
                  <Text>0 {rewardContract.rewardToken.symbol}</Text>
                </HStack>
              )
            ) : // Show Suppliers for non-user contracts
            chartData ? (
              <Text>{formatNumber(chartData[0].suppliers, { maxDecimals: 0 })}</Text>
            ) : isLoadingChart ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : errorChart ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : (
              <Text>0</Text>
            )}
          </MotionVStack>
        </HStack>
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
