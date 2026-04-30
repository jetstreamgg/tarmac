import { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';

const SECONDS_PER_DAY = 86_400;

const secondsToExpiry = (expiry: number): number =>
  Math.max(0, expiry - Math.floor(Date.now() / 1000));

type TimeToMaturityCardProps = {
  market: PendleMarketConfig;
  /** 180 days is the typical Pendle market window — used as the assumed start when no
   * indexer-provided start is available. */
  assumedDurationDays?: number;
};

export const TimeToMaturityCard = ({ market, assumedDurationDays = 180 }: TimeToMaturityCardProps) => {
  const remainingSeconds = secondsToExpiry(market.expiry);
  const totalSeconds = assumedDurationDays * SECONDS_PER_DAY;
  const elapsedSeconds = Math.max(0, totalSeconds - Math.max(0, remainingSeconds));
  const pct = useMemo(
    () => Math.min(100, (elapsedSeconds / totalSeconds) * 100),
    [elapsedSeconds, totalSeconds]
  );

  const remainingLabel = remainingSeconds <= 0 ? (
    <Trans>Matured</Trans>
  ) : (
    <Trans>{Math.round(remainingSeconds / SECONDS_PER_DAY)} days remaining</Trans>
  );

  const maturityDateLabel = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <Card variant="stats" className="w-full">
      <CardTitle>
        <Trans>Time to maturity</Trans>
      </CardTitle>
      <CardContent>
        <div className="mt-2 flex items-center justify-between">
          <Text variant="medium" className="text-text">
            {remainingLabel}
          </Text>
          <Text variant="small" className="text-textSecondary">
            {maturityDateLabel}
          </Text>
        </div>
        <div
          className="bg-card mt-3 h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-violet-400 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
