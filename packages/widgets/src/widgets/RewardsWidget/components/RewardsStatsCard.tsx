import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { RewardContract, useRewardContractInfo, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { RewardsStatsCardCore } from './RewardsStatsCardCore';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { positionAnimations } from '@widgets/shared/animation/presets';

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

  const mostRecentData = chartData
    ? [...chartData].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0]
    : null;

  return (
    <RewardsStatsCardCore
      rewardContract={rewardContract}
      onClick={onClick}
      isConnectedAndEnabled={isConnectedAndEnabled}
      className="bg-radial-(--gradient-position) from-card to-card hover:from-primary-start/100 hover:to-primary-end/100 active:from-primary-start/100 active:to-primary-end/100 transition"
      content={
        <HStack className="mt-5 justify-between" gap={2}>
          <MotionVStack className="justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
            {data ? (
              <Text>{formatBigInt(data?.totalSupplied, { maxDecimals: 0 })} USDS</Text>
            ) : isLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : error ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
          <MotionVStack className="items-end justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`Suppliers`}</Text>
            {mostRecentData ? (
              <Text>{formatNumber(mostRecentData?.suppliers, { maxDecimals: 0 })}</Text>
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
