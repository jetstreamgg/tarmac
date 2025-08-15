import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { formatYsrAsApy } from '@jetstreamgg/sky-utils';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { JSX } from 'react';

export const StUSDSStatsCardCore = ({
  content,
  onExternalLinkClicked
}: {
  content: JSX.Element;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { data: stUsdsData, isLoading: isStUsdsDataLoading } = useStUsdsData();
  const moduleRate = stUsdsData?.moduleRate || 0n;

  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'stUSDS' }} />
          <Text>stUSDS</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {isStUsdsDataLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-12" />
          ) : (
            <Text className="text-bullish">
              {moduleRate > 0n ? `Rate: ${formatYsrAsApy(moduleRate)}` : 'Rate: --'}
            </Text>
          )}
          <PopoverRateInfo type="stusds" onExternalLinkClicked={onExternalLinkClicked} />
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
