import { useMemo, useState } from 'react';
import { parseEther } from 'viem';
import { Trans } from '@lingui/react/macro';
import { getIlkName } from '@/hooks/vaults/helpers';
import { newestStakeHistoricPoint, useStakeHistoricData } from '@/hooks/stake/useStakeHistoricData';
import { useCollateralData } from '@/hooks/vaults/useCollateralData';
import { formatWad } from '@/utils/formatUnits';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useStakeRewardsRate } from '../hooks/useStakeRewardsRate';

type Metric = 'rate' | 'borrow' | 'tvl';

// toFixed(18) strips scientific notation before parseEther, matching legacy StakeChart.
const toEtherScaled = (value: number) => parseEther(value.toFixed(18));

/**
 * Statistics-tab chart card (comp 1036:208698): a `Staking Reward Rate` hero
 * with a `Staking rate | Borrow rate | TVL` series toggle and a `1W/1M/1Y/All`
 * range picker, rendered through the shared Chart's `detail` variant. All
 * series ride the `useParseTvlChartData` pipeline the legacy `StakeChart`
 * demonstrates. The staking-rate metric is the highest-rate farm's history and
 * latest value — the same figure the Sky Staking Engine promo card headlines —
 * so hero and series agree by construction. The borrow-rate series reads the
 * per-point `borrowRate` of the historic endpoint (APP-399 #7); its hero is
 * the onchain stability fee (APP-640). Read-only.
 */
export function StakeRateChart() {
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: historicData, isLoading, error } = useStakeHistoricData();
  // Onchain annualized stability fee (WAD ratio) — the live Borrow rate hero.
  const { data: collateralData } = useCollateralData(getIlkName(2));
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
  const borrowInput = useMemo(
    () =>
      (historicData || []).map(item => ({
        blockTimestamp: new Date(item.date).getTime() / 1000,
        amount: toEtherScaled(item.borrowRate * 100)
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
  const borrowData = useParseTvlChartData(timeFrame, borrowInput);
  const tvlData = useParseTvlChartData(timeFrame, tvlInput);

  // TVL hero = the newest raw datapoint, independent of the timeframe-filtered
  // chart series.
  const mostRecent = useMemo(() => newestStakeHistoricPoint(historicData), [historicData]);
  // Borrow rate hero = the onchain stability fee, the figure the engine card
  // and the open/manage flows show, so it moves the moment a spell changes the
  // rate (APP-640). The plotted series stays on the daily historic endpoint —
  // the only source with history — so right after a change the hero leads the
  // line's last point until the next daily row. Until the onchain read lands
  // the hero falls back to the newest historic point.
  const borrowRateNow =
    collateralData?.stabilityFee !== undefined
      ? Number(formatWad(collateralData.stabilityFee)) * 100
      : mostRecent !== undefined
        ? mostRecent.borrowRate * 100
        : undefined;

  const isRate = metric === 'rate';
  const isBorrow = metric === 'borrow';
  const isPercentMetric = isRate || isBorrow;
  const displayValue = isRate
    ? currentRate !== null
      ? currentRate * 100
      : undefined
    : isBorrow
      ? borrowRateNow
      : mostRecent?.tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="stake-rate-chart"
        // Brand indigo (Figma Components/Charts/bg-chart1), not the shared teal.
        color="var(--color-chart1)"
        data={isRate ? rateData : isBorrow ? borrowData : tvlData}
        isLoading={isRate ? rewardsLoading : isLoading}
        error={isRate ? rewardsError : error}
        isPercentage={isPercentMetric}
        prefix={isPercentMetric ? undefined : '$'}
        label={
          isRate ? (
            <Trans>Staking Reward Rate</Trans>
          ) : isBorrow ? (
            <Trans>Borrow Rate</Trans>
          ) : (
            <Trans>Total value locked</Trans>
          )
        }
        // TVL tags its figure with the period's change like every other TVL
        // chart (APP-552); the rate metrics stay plain.
        showTrend={!isPercentMetric}
        displayValue={displayValue}
        metrics={[
          { value: 'rate', label: <Trans>Staking rate</Trans> },
          { value: 'borrow', label: <Trans>Borrow rate</Trans> },
          { value: 'tvl', label: <Trans>TVL</Trans> }
        ]}
        activeMetric={metric}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
