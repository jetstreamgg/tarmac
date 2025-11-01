import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { useMkrSkyFee } from '@jetstreamgg/sky-hooks';
import { math } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';

export function MkrDelayedUpgradePenalty() {
  const { data: mkrSkyFee, isLoading, error } = useMkrSkyFee();

  // Calculate the penalty percentage from the WAD-scaled fee
  const penaltyValue = mkrSkyFee ? math.calculateUpgradePenalty(mkrSkyFee) : '0';

  return (
    <StatsCard
      title={
        <span className="flex items-center gap-1">
          <Trans>MKR Delayed Upgrade Penalty</Trans>
          <PopoverRateInfo type="delayedUpgradePenalty" />
        </span>
      }
      isLoading={isLoading}
      error={error}
      content={<Text className="mt-2">{penaltyValue} %</Text>}
    />
  );
}
