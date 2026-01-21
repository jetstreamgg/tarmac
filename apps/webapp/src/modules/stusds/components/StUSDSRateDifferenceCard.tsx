import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useCurveRate, useStUsdsData, calculateRateDifferencePercent } from '@jetstreamgg/sky-hooks';
import { PopoverInfo, getTooltipById } from '@jetstreamgg/sky-widgets';

export function StUSDSRateDifferenceCard() {
  const { i18n } = useLingui();
  const { curveRate, isLoading: isCurveLoading } = useCurveRate();
  const { data: stUsdsData, isLoading: isStUsdsLoading } = useStUsdsData();

  const nativeRate = stUsdsData?.assetPerShare || 0n;

  // Calculate rate difference (Curve vs Native)
  const rateDifference =
    curveRate && curveRate > 0n && nativeRate > 0n
      ? calculateRateDifferencePercent(curveRate, nativeRate)
      : 0;

  const hasData = curveRate && curveRate > 0n && nativeRate > 0n;

  const tooltipContent = getTooltipById('curve-vs-native-rate-difference');

  return (
    <StatsCard
      className="h-full"
      isLoading={isCurveLoading || isStUsdsLoading}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Curve vs. Native Rate difference`)}</span>
          <PopoverInfo
            title={i18n._(msg`${tooltipContent?.title || 'Curve vs. Native Rate difference'}`)}
            description={i18n._(msg`${tooltipContent?.tooltip || ''}`)}
            iconClassName="text-textSecondary hover:text-white transition-colors"
            iconSize="medium"
          />
        </div>
      }
      content={
        <div className="mt-2">
          {hasData ? (
            <Text variant="large">{Math.abs(rateDifference).toFixed(2)}%</Text>
          ) : (
            <Text variant="large" className="text-textSecondary">
              --
            </Text>
          )}
        </div>
      }
    />
  );
}
