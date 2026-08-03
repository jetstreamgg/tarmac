import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { usePendleMarketChartData, usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { Chart, TimeFrame, type Data } from '@/modules/ui/components/Chart';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

type Metric = 'rate' | 'tvl';

const SECONDS_PER_DAY = 86_400;

/**
 * The product-detail Rate/TVL chart for a Pendle market — injected into
 * ProductDetailTemplate's `chart` slot, mirroring SavingsDetailChart's
 * composition. The daily series covers the whole market lifetime (markets live
 * for months), so timeframe filtering happens client-side.
 */
export function PendleDetailChart({ market }: { market: PendleMarketConfig }) {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: points, isLoading, error } = usePendleMarketChartData(market.marketAddress);
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  const isRate = metric === 'rate';

  const data = useMemo<Data[]>(() => {
    if (!points) return [];
    const cutoffSec = Math.floor(Date.now() / 1000) - getDayCountFromTimeFrame(timeFrame) * SECONDS_PER_DAY;
    return points
      .filter(point => point.timestampSec >= cutoffSec)
      .flatMap(point => {
        const value = isRate ? point.impliedApy : (point.tvl ?? 0);
        // A bucket the API serves without a rate is skipped rather than drawn
        // as a 0% dip. The two fields are independently optional, so this only
        // ever drops the metric that's actually missing.
        if (value === undefined) return [];
        // Rate plots percent units (0.045 → 4.5); TVL plots raw USD.
        return [{ value: isRate ? value * 100 : value, date: new Date(point.timestampSec * 1000) }];
      });
  }, [points, timeFrame, isRate]);

  // Headline reads the canonical current rate (matches the Details grid), not
  // the last historic bucket.
  const currentRate = stats?.impliedApy !== undefined ? stats.impliedApy * 100 : undefined;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="pendle-detail-chart"
        data={data}
        isLoading={isLoading}
        error={error ?? undefined}
        isPercentage={isRate}
        symbol={isRate ? undefined : 'USD'}
        label={isRate ? <Trans>Fixed APY</Trans> : <Trans>TVL</Trans>}
        displayValue={isRate ? currentRate : stats?.tvl}
        metrics={[
          { value: 'rate', label: <Trans>Rate</Trans> },
          { value: 'tvl', label: <Trans>TVL</Trans> }
        ]}
        activeMetric={metric}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
