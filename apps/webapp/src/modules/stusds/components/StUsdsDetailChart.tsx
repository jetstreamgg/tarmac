import { useState } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useStUsdsChartInfo, useStUsdsData } from '@/hooks';
import { calculateApyFromStr } from '@/utils';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useParseStUsdsChartData } from '../hooks/useParseStUsdsChartData';

type Metric = 'rate' | 'tvl';

const LIVE_LABEL = 'Current value';

/**
 * The product-detail Rate/TVL chart for stUSDS — injected into
 * ProductDetailTemplate's `chart` slot. Same data pipeline as the legacy
 * `StUSDSChart` (`useStUsdsChartInfo` history via `useParseStUsdsChartData`),
 * with the live trailing point from the on-chain module data, rendered through
 * the shared Chart's `detail` variant — mirroring `VaultDetailChart`.
 */
export function StUsdsDetailChart() {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: chartInfo, isLoading, error } = useStUsdsChartInfo();
  const { data: stUsdsData } = useStUsdsData();

  const parsed = useParseStUsdsChartData(timeFrame, chartInfo || []);
  const isRate = metric === 'rate';

  // Headline + live trailing point come from the canonical on-chain module data
  // (matches the Details grid), appended to the historic series.
  const liveRate = stUsdsData ? calculateApyFromStr(stUsdsData.moduleRate) : undefined;
  const liveTvl = stUsdsData ? parseFloat(formatUnits(stUsdsData.totalAssets, 18)) : undefined;

  const rateData =
    liveRate !== undefined && parsed.rate.length > 0
      ? [...parsed.rate, { value: liveRate, date: new Date(), tooltipLabel: LIVE_LABEL }]
      : parsed.rate;
  const tvlData =
    liveTvl !== undefined && parsed.tvl.length > 0
      ? [...parsed.tvl, { value: liveTvl, date: new Date(), tooltipLabel: LIVE_LABEL }]
      : parsed.tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="stusds-detail-chart"
        data={isRate ? rateData : tvlData}
        isLoading={isLoading}
        error={error}
        isPercentage={isRate}
        hidePercentChange={isRate}
        symbol={isRate ? undefined : 'USDS'}
        tokenSymbols={isRate ? undefined : ['USDS']}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>TVL</Trans>}
        displayValue={isRate ? liveRate : liveTvl}
        tooltipLabel="Daily average"
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
