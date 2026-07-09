import { useMemo, useState } from 'react';
import { formatUnits, parseEther } from 'viem';
import { Trans } from '@lingui/react/macro';
import { getIlkName, useCollateralData, useStakeHistoricData } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';

type Metric = 'rate' | 'tvl';

// borrowRate arrives as a decimal fraction (0.05 = 5%); the Chart plots percent units.
const toPercent = (fraction: number) => fraction * 100;

// toFixed(18) strips scientific notation before parseEther, matching legacy StakeChart.
const toEtherScaled = (value: number) => parseEther(value.toFixed(18));

/**
 * Statistics-tab chart card (hi-fi 486:31955): a `Current Rate` hero with a
 * `Rate | TVL` series toggle and a `1W/1M/1Y/All` range picker, rendered through
 * the shared Chart's `detail` variant. Both series ride the `useParseTvlChartData`
 * pipeline the legacy `StakeChart` demonstrates — the Rate series is scaled into
 * percent units. The rate HERO is the on-chain stability fee (what the protocol
 * actually charges, and what the details strip's identically-labeled stat shows),
 * not the charted analytics series' latest point — the two can lag apart; the
 * series value only stands in if the on-chain read fails. Read-only.
 */
export function StakeRateChart() {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: historicData, isLoading, error } = useStakeHistoricData();

  const rateInput = useMemo(
    () =>
      (historicData || []).map(item => ({
        blockTimestamp: new Date(item.date).getTime() / 1000,
        amount: toEtherScaled(toPercent(item.borrowRate))
      })),
    [historicData]
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

  const { data: collateralData, isLoading: collateralLoading } = useCollateralData(getIlkName(2));
  const stabilityFeePercent =
    collateralData?.stabilityFee !== undefined
      ? Number(formatUnits(collateralData.stabilityFee, 18)) * 100
      : undefined;

  const isRate = metric === 'rate';
  const displayValue = isRate ? stabilityFeePercent : mostRecent?.tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="stake-rate-chart"
        // Brand indigo (Figma Components/Charts/bg-chart1), not the shared teal.
        color="#757dff"
        data={isRate ? rateData : tvlData}
        isLoading={isLoading || (isRate && collateralLoading)}
        error={error}
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
