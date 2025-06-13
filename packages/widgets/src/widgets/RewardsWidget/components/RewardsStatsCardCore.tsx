import { Button } from '@widgets/components/ui/button';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { PairTokenIcons } from '@widgets/shared/components/ui/token/PairTokenIcon';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { RewardContract, TOKENS, WriteHook, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { JSX } from 'react';
import { useChainId } from 'wagmi';

export const RewardsStatsCardCore = ({
  rewardContract,
  content,
  claim,
  rewardsBalance,
  onClick,
  onClaimClick,
  className,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: {
  rewardContract: RewardContract;
  claim?: WriteHook;
  rewardsBalance?: bigint;
  content: JSX.Element;
  className?: string;
  onClick?: (rewardContract: RewardContract) => void;
  onClaimClick?: () => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const chainId = useChainId();
  const rewardTokenDecimals = rewardContract.rewardToken.decimals;
  const parsedRewardTokenDecimals = !rewardTokenDecimals
    ? 18
    : typeof rewardTokenDecimals === 'number'
      ? rewardTokenDecimals
      : rewardTokenDecimals[chainId] || 18;
  const MIN_CLAIM_DISPLAY = BigInt(10 ** (parsedRewardTokenDecimals - 2)); // 0.01

  const {
    data: chartData,
    isLoading,
    error
  } = useRewardsChartInfo({
    rewardContractAddress: rewardContract.contractAddress
  });

  // Get the most recent data
  const sortedChartData = chartData ? [...chartData].sort((a, b) => b.blockTimestamp - a.blockTimestamp) : [];
  const mostRecentRate = sortedChartData.length > 0 ? sortedChartData[0].rate : null;

  return (
    <StatsOverviewCardCore
      className={className}
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <PairTokenIcons
            leftToken={rewardContract.supplyToken.symbol}
            rightToken={rewardContract.rewardToken.symbol}
          />
          <Text className="whitespace-nowrap">{rewardContract.name}</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {rewardContract.rewardToken.symbol !== TOKENS.cle.symbol && mostRecentRate ? (
            <>
              <Text className="text-bullish">
                <Trans>Rate: {formatDecimalPercentage(parseFloat(mostRecentRate))}</Trans>
              </Text>
              <PopoverRateInfo type="str" onExternalLinkClicked={onExternalLinkClicked} />
            </>
          ) : isLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-10" />
          ) : error ? (
            <Warning boxSize={16} viewBox="0 0 16 16" />
          ) : (
            ''
          )}
        </MotionHStack>
      }
      content={content}
      footerContent={
        <motion.div
          variants={positionAnimations}
          className={`flex w-full justify-center ${!!rewardsBalance && !!claim ? 'mt-3' : ''}`}
        >
          {isConnectedAndEnabled && !!rewardsBalance && !!claim ? (
            <Button disabled={!claim.prepared} onClick={onClaimClick} variant="primaryAlt">
              <Trans>
                {`Claim ${
                  rewardsBalance < MIN_CLAIM_DISPLAY
                    ? `<${formatBigInt(MIN_CLAIM_DISPLAY, { maxDecimals: 2 })}`
                    : formatBigInt(rewardsBalance, { maxDecimals: 2 })
                } ${rewardContract.rewardToken.symbol}`}
              </Trans>
            </Button>
          ) : undefined}
        </motion.div>
      }
      onClick={onClick}
    />
  );
};
