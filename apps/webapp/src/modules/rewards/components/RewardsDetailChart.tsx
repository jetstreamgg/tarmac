import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useRewardsChartInfo, type RewardContract } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useParseRewardsChartData } from '../hooks/useParseRewardsChartData';

type Metric = 'rate' | 'tvl';

/**
 * The product-detail Rate/TVL chart for a reward farm — injected into
 * ProductDetailTemplate's `chart` slot. Owns the metric + timeframe state and
 * feeds the shared Chart's `detail` variant. Both series come from the one
 * BA Labs farms endpoint (`useRewardsChartInfo`), parsed through the existing
 * `useParseRewardsChartData` pipeline.
 *
 * Farms without a live rate (Chronicle points, the deprecated SKY farm) hide
 * the Rate tab and render TVL only — same behaviour as the legacy details pane.
 */
export function RewardsDetailChart({
  contract,
  currentRate
}: {
  contract: RewardContract;
  /** Latest rate as a decimal fraction; undefined/0 hides the Rate metric. */
  currentRate?: number;
}) {
  const hasRate = (currentRate ?? 0) > 0;
  const [metric, setMetric] = useState<Metric>(hasRate ? 'rate' : 'tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const {
    data: chartInfo,
    isLoading,
    error
  } = useRewardsChartInfo({
    rewardContractAddress: contract.contractAddress,
    limit: getDayCountFromTimeFrame(timeFrame)
  });
  const { totalSupplied: tvlData, rate: rateData } = useParseRewardsChartData(timeFrame, chartInfo || []);

  // A rate can arrive after mount (async); never leave the toggle on a hidden tab.
  const isRate = metric === 'rate' && hasRate;
  const metrics = useMemo(
    () =>
      hasRate
        ? [
            { value: 'rate', label: <Trans>Rate</Trans> },
            { value: 'tvl', label: <Trans>TVL</Trans> }
          ]
        : [{ value: 'tvl', label: <Trans>TVL</Trans> }],
    [hasRate]
  );

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="rewards-detail-chart"
        data={isRate ? rateData : tvlData}
        isLoading={isLoading}
        error={error}
        isPercentage={isRate}
        symbol={isRate ? undefined : contract.supplyToken.symbol}
        tokenSymbols={isRate ? undefined : [contract.supplyToken.symbol]}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>Total value locked</Trans>}
        // The TVL metric leads its figure with the token mark instead of a
        // trailing ticker and tags it with the period's change, the same
        // recipe the portfolio totals chart wears (APP-552, Figma 2800:92438).
        icons={
          isRate ? undefined : (
            <TokenIconStack symbols={[contract.supplyToken.symbol]} size={32} className="shrink-0" />
          )
        }
        showTrend={!isRate}
        // Headline reads the canonical current rate (matches the Details grid),
        // not the last historic point.
        displayValue={isRate && currentRate !== undefined ? currentRate * 100 : undefined}
        metrics={metrics}
        activeMetric={isRate ? 'rate' : 'tvl'}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
