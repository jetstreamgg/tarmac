import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  isMarketMatured,
  useNow,
  usePendleMarketChartData,
  usePendleMarketsApiData,
  type PendleMarketConfig
} from '@/hooks';
import { Chart, TimeFrame, type Data } from '@/modules/ui/components/Chart';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';

import { SECONDS_PER_DAY } from '@/utils';

/**
 * The product-detail Rate chart for a Pendle market — injected into
 * ProductDetailTemplate's `chart` slot, mirroring SavingsDetailChart's
 * composition. The daily series covers the whole market lifetime (markets live
 * for months), so timeframe filtering happens client-side.
 *
 * Once the market matures the series ends at expiry, so the timeframe window
 * is counted back from expiry rather than now.
 *
 * Rate is the only series: the Liquidity one was pulled in APP-527 because the
 * figure it plotted is AMM liquidity, not the total liquidity the design asks
 * for. `usePendleMarketChartData` still carries the series so it can come back.
 */
export function PendleDetailChart({ market }: { market: PendleMarketConfig }) {
  const { t } = useLingui();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: points, isLoading, error } = usePendleMarketChartData(market.marketAddress);
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  // The window's cutoff moves with the clock; the series is daily, so a minute
  // tick is plenty.
  const nowMs = useNow();
  const matured = isMarketMatured(market.expiry);
  const data = useMemo<Data[]>(() => {
    if (!points) return [];
    const endSec = matured ? market.expiry : Math.floor(nowMs / 1000);
    const cutoffSec = endSec - getDayCountFromTimeFrame(timeFrame) * SECONDS_PER_DAY;
    return (
      points
        // Pendle serves one bucket after expiry with the rate at 0%, which would draw a false cliff.
        .filter(point => point.timestampSec >= cutoffSec && (!matured || point.timestampSec < market.expiry))
        .flatMap(point => {
          // A bucket the API serves without a rate is skipped rather than drawn
          // as a 0% dip.
          if (point.impliedApy === undefined) return [];
          // Percent units (0.045 → 4.5).
          return [{ value: point.impliedApy * 100, date: new Date(point.timestampSec * 1000) }];
        })
    );
  }, [points, timeFrame, nowMs, matured, market.expiry]);

  // Headline reads the canonical current figure (matching the Details grid),
  // not the last historic bucket.
  const currentRate = stats?.impliedApy !== undefined ? stats.impliedApy * 100 : undefined;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="pendle-detail-chart"
        data={data}
        isLoading={isLoading}
        error={error ?? undefined}
        isPercentage
        label={<Trans>Fixed APY</Trans>}
        tooltipLabel={<Trans>Rate</Trans>}
        displayValue={currentRate}
        displayText={matured ? t`Matured on ${formatMaturity(market.expiry)}` : undefined}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
