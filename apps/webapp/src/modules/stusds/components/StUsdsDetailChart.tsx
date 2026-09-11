import { useState } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useStUsdsChartInfo, useStUsdsData } from '@/hooks';
import { calculateApyFromStr } from '@/utils';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
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

  // The range picker drives the row budget, like every other detail chart —
  // the endpoint's 100-row default clipped 1Y and All (APP-456 #5).
  const {
    data: chartInfo,
    isLoading,
    error
  } = useStUsdsChartInfo({
    limit: getDayCountFromTimeFrame(timeFrame)
  });
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
  // The TVL series gets no live point: BA Labs' daily `stusds_tvl` is not the
  // module's on-chain `totalAssets` (measured 224.3M vs 209.0M on the same
  // day), so a trailing on-chain point drew a step off the end of the daily
  // series that read as a cliff on 1W (APP-563 #11). The headline keeps the
  // on-chain figure, matching the Details grid.
  const tvlData = parsed.tvl;

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
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>Total value locked</Trans>}
        // The TVL metric leads its figure with the token mark instead of a
        // trailing ticker and tags it with the period's change, the same
        // recipe the portfolio totals chart wears (APP-552, Figma 2800:92438).
        icons={isRate ? undefined : <TokenIconStack symbols={['USDS']} size={32} className="shrink-0" />}
        showTrend={!isRate}
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
