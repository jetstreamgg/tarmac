import { Skeleton } from '@widgets/components/ui/skeleton';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { JSX } from 'react';

export const SavingsStatsCardCore = ({
  content,
  isLoading,
  onExternalLinkClicked
}: {
  content: JSX.Element;
  isLoading: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { data: overallSkyData, isLoading: isOverallSkyDataLoading } = useOverallSkyData();

  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'USDS' }} />
          <Text>Sky Savings Rate</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {isLoading || isOverallSkyDataLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-12" />
          ) : (
            <Text className="text-bullish">
              {overallSkyData?.skySavingsRatecRate
                ? `Rate: ${formatDecimalPercentage(parseFloat(overallSkyData.skySavingsRatecRate))}`
                : '--'}
            </Text>
          )}
          <PopoverRateInfo type="ssr" onExternalLinkClicked={onExternalLinkClicked} />
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
