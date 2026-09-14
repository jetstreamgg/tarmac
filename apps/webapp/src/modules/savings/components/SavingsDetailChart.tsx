import { useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { useSavingsChartInfo, useSkySavingsRateHistoricData, useOverallSkyData } from '@/hooks';
import { isL2ChainId } from '@/utils';
import { Chart, TimeFrame, Data } from '@/modules/ui/components/Chart';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

type Metric = 'rate' | 'tvl';

// BA Labs /save/ssr/historic/ only accepts specific day buckets for days_ago.
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

/**
 * The product-detail Rate/TVL chart for Savings — injected into
 * ProductDetailTemplate's `chart` slot. Owns the metric + timeframe state and
 * feeds the shared Chart's `detail` variant.
 */
export function SavingsDetailChart() {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');
  const chainId = useChainId();
  const chartChainId = isL2ChainId(chainId) ? 1 : chainId; // L2s read mainnet history

  const { data: overall } = useOverallSkyData();

  // TVL series (sUSDS supply) — the existing savings pipeline.
  const {
    data: tvlInfo,
    isLoading: tvlLoading,
    error: tvlError
  } = useSavingsChartInfo(chartChainId, { limit: getDayCountFromTimeFrame(timeFrame) });
  const tvlData = useParseTvlChartData(timeFrame, tvlInfo || []);

  // Rate series — BA Labs SSR historic. `rate` is a decimal fraction (same
  // scale as skySavingsRatecRate), so ×100 to plot percent units.
  const {
    data: rateInfo,
    isLoading: rateLoading,
    error: rateError
  } = useSkySavingsRateHistoricData({ daysAgo: ssrDaysAgoFromTimeFrame(timeFrame) });
  const rateData = useMemo<Data[]>(
    () =>
      [...(rateInfo || [])]
        .sort((a, b) => a.blockTimestamp - b.blockTimestamp)
        .map(item => ({ value: parseFloat(item.rate) * 100, date: new Date(item.blockTimestamp * 1000) })),
    [rateInfo]
  );

  const isRate = metric === 'rate';
  // Headline reads the canonical current rate (matches the Details grid), not
  // the last historic point.
  const currentRate = overall?.skySavingsRatecRate
    ? parseFloat(overall.skySavingsRatecRate) * 100
    : undefined;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="savings-detail-chart"
        data={isRate ? rateData : tvlData}
        isLoading={isRate ? rateLoading : tvlLoading}
        error={isRate ? rateError : tvlError}
        isPercentage={isRate}
        symbol={isRate ? undefined : 'sUSDS'}
        tokenSymbols={isRate ? undefined : ['sUSDS']}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>Total value locked</Trans>}
        // The TVL metric leads its figure with the token mark instead of a
        // trailing ticker and tags it with the period's change, the same
        // recipe the portfolio totals chart wears (APP-552, Figma 2800:92438).
        icons={isRate ? undefined : <TokenIconStack symbols={['sUSDS']} size={32} className="shrink-0" />}
        showTrend={!isRate}
        displayValue={isRate ? currentRate : undefined}
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
