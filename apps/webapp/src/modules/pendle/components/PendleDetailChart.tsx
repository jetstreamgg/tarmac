import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { usePendleMarketChartData, usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { Chart, TimeFrame, type Data } from '@/modules/ui/components/Chart';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

const SECONDS_PER_DAY = 86_400;

/**
 * The product-detail Rate chart for a Pendle market — injected into
 * ProductDetailTemplate's `chart` slot, mirroring SavingsDetailChart's
 * composition. The daily series covers the whole market lifetime (markets live
 * for months), so timeframe filtering happens client-side.
 *
 * Rate is the only series: the Liquidity one was pulled in APP-527 because the
 * figure it plotted is AMM liquidity, not the total liquidity the design asks
 * for. `usePendleMarketChartData` still carries the series so it can come back.
 */
export function PendleDetailChart({ market }: { market: PendleMarketConfig }) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: points, isLoading, error } = usePendleMarketChartData(market.marketAddress);
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  const data = useMemo<Data[]>(() => {
    if (!points) return [];
    const cutoffSec = Math.floor(Date.now() / 1000) - getDayCountFromTimeFrame(timeFrame) * SECONDS_PER_DAY;
    return points
      .filter(point => point.timestampSec >= cutoffSec)
      .flatMap(point => {
        // A bucket the API serves without a rate is skipped rather than drawn
        // as a 0% dip.
        if (point.impliedApy === undefined) return [];
        // Percent units (0.045 → 4.5).
        return [{ value: point.impliedApy * 100, date: new Date(point.timestampSec * 1000) }];
      });
  }, [points, timeFrame]);

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
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
