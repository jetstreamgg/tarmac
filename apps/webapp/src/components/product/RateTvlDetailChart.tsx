import { useMemo, useState, type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Chart, type Data, type TimeFrame } from '@/modules/ui/components/Chart';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

type Metric = 'rate' | 'tvl';

/** Tooltip label of the live trailing point some series append to their history. */
const LIVE_LABEL = 'Current value';

/**
 * Appends the canonical live value as a trailing "Current value" point to a
 * historic series — only when both exist, so an empty history stays empty.
 */
export function withLivePoint(series: Data[], live: number | undefined): Data[] {
  return live !== undefined && series.length > 0
    ? [...series, { value: live, date: new Date(), tooltipLabel: LIVE_LABEL }]
    : series;
}

type DetailChartSeries = {
  data: Data[];
  isLoading: boolean;
  error?: Error | null;
  /** Headline figure; falls back to the series' last point when undefined. */
  displayValue?: number;
};

/**
 * The product-detail Rate/TVL chart shared by the Savings, stUSDS, rewards and
 * Morpho vault pages — injected into ProductDetailTemplate's `chart` slot. Owns
 * the metric + timeframe state and feeds the shared Chart's `detail` variant;
 * the caller owns the data pipeline and hands in one series per metric.
 */
export function RateTvlDetailChart({
  dataTestId,
  symbol,
  rate,
  tvl,
  hideRate = false,
  rateValueSuffix,
  tooltipLabel,
  onTimeFrameChange
}: {
  dataTestId: string;
  /** The TVL token: ticker after the figure, mark before it, tooltip unit. */
  symbol: string;
  rate: DetailChartSeries;
  tvl: DetailChartSeries;
  /** Drops the Rate tab and renders TVL only (farms without a live rate). */
  hideRate?: boolean;
  /** Rendered after the rate headline (e.g. a rate-breakdown mark). */
  rateValueSuffix?: ReactNode;
  tooltipLabel?: ReactNode;
  onTimeFrameChange: (timeFrame: TimeFrame) => void;
}) {
  const [metric, setMetric] = useState<Metric>(hideRate ? 'tvl' : 'rate');

  // A rate can arrive after mount (async); never leave the toggle on a hidden tab.
  const isRate = metric === 'rate' && !hideRate;
  const metrics = useMemo(
    () =>
      hideRate
        ? [{ value: 'tvl', label: <Trans>TVL</Trans> }]
        : [
            { value: 'rate', label: <Trans>Rate</Trans> },
            { value: 'tvl', label: <Trans>TVL</Trans> }
          ],
    [hideRate]
  );

  const series = isRate ? rate : tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId={dataTestId}
        data={series.data}
        isLoading={series.isLoading}
        error={series.error}
        isPercentage={isRate}
        symbol={isRate ? undefined : symbol}
        tokenSymbols={isRate ? undefined : [symbol]}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>Total value locked</Trans>}
        // The TVL metric leads its figure with the token mark instead of a
        // trailing ticker and tags it with the period's change, the same
        // recipe the portfolio totals chart wears (APP-552, Figma 2800:92438).
        icons={isRate ? undefined : <TokenIconStack symbols={[symbol]} size={32} className="shrink-0" />}
        showTrend={!isRate}
        displayValue={series.displayValue}
        valueSuffix={isRate ? rateValueSuffix : undefined}
        tooltipLabel={tooltipLabel}
        metrics={metrics}
        activeMetric={isRate ? 'rate' : 'tvl'}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={onTimeFrameChange}
      />
    </ErrorBoundary>
  );
}
