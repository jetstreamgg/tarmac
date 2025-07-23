import { Skeleton } from '@widgets/components/ui/skeleton';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { JSX } from 'react';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { formatYsrAsApy } from '@jetstreamgg/sky-utils';

export const StUSDSStatsCardCore = ({
  content,
  isLoading
}: {
  content: JSX.Element;
  isLoading: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { i18n } = useLingui();
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();

  const moduleRate = stUsdsData?.moduleRate || 0n;
  const formattedRate = moduleRate > 0n ? formatYsrAsApy(moduleRate) : '0.00%';

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
          {isLoading || stUsdsLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-16" />
          ) : (
            <>
              <Text className="text-primary">
                <Text tag="span" className="text-bullish ml-1">
                  {formattedRate}
                </Text>
              </Text>
              <InfoTooltip
                content={
                  <Text variant="small">
                    {i18n._(
                      msg`stUSDS rate fluctuates based on borrowing demand. Returns are not guaranteed.`
                    )}
                  </Text>
                }
              />
            </>
          )}
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
