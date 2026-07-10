import { useMemo, useState } from 'react';
import { parseEther } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useStakeHistoricData } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useStakeRewardsRate } from '../hooks/useStakeRewardsRate';

type Metric = 'rate' | 'tvl';

// toFixed(18) strips scientific notation before parseEther, matching legacy StakeChart.
const toEtherScaled = (value: number) => parseEther(value.toFixed(18));

/**
 * Statistics-tab chart card (hi-fi 486:31955): a `Current Rate` hero with a
 * `Rate | TVL` series toggle and a `1W/1M/1Y/All` range picker, rendered through
 * the shared Chart's `detail` variant. Both series ride the `useParseTvlChartData`
 * pipeline the legacy `StakeChart` demonstrates. The Rate metric is the staking
 * REWARDS rate — the highest-rate farm's history and latest value, the same
 * figure the Sky Staking Engine promo card headlines (product call on the F1
 * review; the borrow rate lives in the open/manage borrow cards instead). The
 * rate hero reads that farm's latest datapoint, so hero and series agree by
 * construction. Read-only.
 */
export function StakeRateChart() {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: historicData, isLoading, error } = useStakeHistoricData();
  const {
    series: rewardsSeries,
    currentRate,
    isLoading: rewardsLoading,
    error: rewardsError
  } = useStakeRewardsRate();

  const rateInput = useMemo(
    () =>
      rewardsSeries.map(item => ({
        blockTimestamp: item.blockTimestamp,
        // `rate` is a decimal fraction (0.05 = 5%); the Chart plots percent units.
        amount: toEtherScaled(parseFloat(item.rate) * 100)
      })),
    [rewardsSeries]
  );
  const tvlInput = useMemo(
    () =>
      (historicData || []).map(item => ({
        blockTimestamp: new Date(item.date).getTime() / 1000,
        amount: toEtherScaled(Number(item.tvl))
      })),
    [historicData]
  );

  const rateData = useParseTvlChartData(timeFrame, rateInput);
  const tvlData = useParseTvlChartData(timeFrame, tvlInput);

  // TVL hero = the newest raw datapoint (sorted by datetime desc), independent
  // of the timeframe-filtered chart series.
  const mostRecent = useMemo(
    () =>
      historicData
        ?.slice()
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0],
    [historicData]
  );

  const isRate = metric === 'rate';
  const displayValue = isRate ? (currentRate !== null ? currentRate * 100 : undefined) : mostRecent?.tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="stake-rate-chart"
        // Brand indigo (Figma Components/Charts/bg-chart1), not the shared teal.
        color="#757dff"
        data={isRate ? rateData : tvlData}
        isLoading={isRate ? rewardsLoading : isLoading}
        error={isRate ? rewardsError : error}
        isPercentage={isRate}
        prefix={isRate ? undefined : '$'}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>TVL</Trans>}
        displayValue={displayValue}
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
