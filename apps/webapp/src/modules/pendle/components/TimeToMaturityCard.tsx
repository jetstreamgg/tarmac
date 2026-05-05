import { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { type PendleMarketConfig, usePendleMarketsApiData } from '@jetstreamgg/sky-hooks';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';

const SECONDS_PER_DAY = 86_400;

const secondsToExpiry = (expiry: number): number =>
  Math.max(0, expiry - Math.floor(Date.now() / 1000));

type TimeToMaturityCardProps = {
  market: PendleMarketConfig;
};

/**
 * Renders the elapsed-vs-total progress bar + remaining-days label.
 *
 * Source-of-truth precedence for the maturity window:
 *   1. Pendle markets API (provides both `startTimestampSec` and `expirySec`,
 *      so the bar reflects the real market duration).
 *   2. Local `PENDLE_MARKETS` config for `expiry` (always present), with a
 *      conservative 180-day fallback duration when API hasn't loaded yet.
 *
 * Days remaining uses Math.floor (counts complete days yet to come) to match
 * Pendle's own UI and intuitive calendar countdown.
 */
export const TimeToMaturityCard = ({ market }: TimeToMaturityCardProps) => {
  const { data: marketsApi } = usePendleMarketsApiData();
  const apiData = marketsApi?.[market.marketAddress];

  const expirySec = apiData?.expirySec ?? market.expiry;
  const startSec = apiData?.startTimestampSec;

  const remainingSeconds = secondsToExpiry(expirySec);
  const totalSeconds = useMemo(() => {
    // Real total when we have both API endpoints; fallback to a 180-day window
    // measured from expiry backward when the API hasn't given us a start.
    if (startSec !== undefined && expirySec > startSec) return expirySec - startSec;
    return 180 * SECONDS_PER_DAY;
  }, [startSec, expirySec]);

  const elapsedSeconds = Math.max(0, totalSeconds - Math.max(0, remainingSeconds));
  const pct = useMemo(() => {
    if (totalSeconds === 0) return 0;
    return Math.min(100, (elapsedSeconds / totalSeconds) * 100);
  }, [elapsedSeconds, totalSeconds]);

  const remainingLabel =
    remainingSeconds <= 0 ? (
      <Trans>Matured</Trans>
    ) : (
      <Trans>{Math.floor(remainingSeconds / SECONDS_PER_DAY)} days remaining</Trans>
    );

  const maturityDateLabel = new Date(expirySec * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const startDateLabel =
    startSec !== undefined
      ? new Date(startSec * 1000).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : null;

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
        {startDateLabel && (
          <Text variant="small" className="text-textSecondary mt-2">
            <Trans>started · {startDateLabel}</Trans>
          </Text>
        )}
      </CardContent>
    </Card>
  );
};
