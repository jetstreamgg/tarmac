import { useMemo, useState } from 'react';
import { parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useUsdsDaiData, useSkySavingsRateHistoricData } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTokenChartData } from '@/modules/ui/hooks/useParseTokenChartData';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

type Metric = 'usds' | 'savings';

// BA Labs /save/ssr/historic/ only accepts specific bucket values for days_ago.
const ssrDaysAgoFromTimeFrame = (tf: TimeFrame): number => {
  switch (tf) {
    case 'w':
      return 7;
    case 'm':
      return 30;
    case 'y':
      return 365;
    case 'all':
    default:
      return 9999;
  }
};

// BA Labs returns high-precision decimal strings; parseUnits requires <=18 dp.
const toBigIntWei = (decimalString: string): bigint =>
  parseUnits(Number(decimalString || '0').toFixed(18), 18);

/**
 * The Portfolio Statistics chart: the same USDS+DAI / Sky Savings supply series
 * as the shared UsdsSkyTotalsChart, but rendered with the Chart `detail` variant
 * (no white panel, taller, no x-axis, metric + timeframe pills top-right) to
 * match the product-detail charts.
 */
export function PortfolioTotalsChart() {
  const [metric, setMetric] = useState<Metric>('usds');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const limit = getDayCountFromTimeFrame(timeFrame);

  const { data: usdsDaiData, isLoading: usdsLoading, error: usdsError } = useUsdsDaiData({ limit });
  const {
    data: ssrData,
    isLoading: ssrLoading,
    error: ssrError
  } = useSkySavingsRateHistoricData({ daysAgo: ssrDaysAgoFromTimeFrame(timeFrame) });

  const usdsInput = useMemo(
    () =>
      (usdsDaiData || []).map(item => ({
        blockTimestamp: item.blockTimestamp,
        amount: toBigIntWei(item.total),
        holders: 0
      })),
    [usdsDaiData]
  );
  const ssrInput = useMemo(
    () =>
      (ssrData || []).map(item => ({
        blockTimestamp: item.blockTimestamp,
        amount: toBigIntWei(item.total),
        holders: 0
      })),
    [ssrData]
  );

  const usdsChart = useParseTokenChartData(timeFrame, usdsInput);
  const ssrChart = useParseTokenChartData(timeFrame, ssrInput);

  const isUsds = metric === 'usds';

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="portfolio-totals-chart"
        data={isUsds ? usdsChart : ssrChart}
        isLoading={isUsds ? usdsLoading : ssrLoading}
        error={isUsds ? usdsError : ssrError}
        symbol="USDS"
        label={isUsds ? <Trans>Total USDS and DAI</Trans> : <Trans>Total Sky Savings Supply</Trans>}
        metrics={[
          { value: 'usds', label: <Trans>USDS</Trans> },
          { value: 'savings', label: <Trans>Savings</Trans> }
        ]}
        activeMetric={metric}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
