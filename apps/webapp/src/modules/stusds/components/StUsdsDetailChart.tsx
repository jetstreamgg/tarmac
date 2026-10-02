import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useStUsdsChartInfo, useStUsdsData } from '@/hooks';
import { calculateApyFromStr } from '@/utils';
import { TimeFrame } from '@/modules/ui/components/Chart';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { RateTvlDetailChart, withLivePoint } from '@/components/product/RateTvlDetailChart';
import { useParseStUsdsChartData } from '../hooks/useParseStUsdsChartData';

/**
 * The product-detail Rate/TVL chart for stUSDS — injected into
 * ProductDetailTemplate's `chart` slot. Same data pipeline as the legacy
 * `StUSDSChart` (`useStUsdsChartInfo` history via `useParseStUsdsChartData`),
 * with the live trailing point from the on-chain module data, rendered through
 * the shared `RateTvlDetailChart` — mirroring `VaultDetailChart`.
 */
export function StUsdsDetailChart() {
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

  // Headline + live trailing point come from the canonical on-chain module data
  // (matches the Details grid), appended to the historic series.
  const liveRate = stUsdsData ? calculateApyFromStr(stUsdsData.moduleRate) : undefined;
  const liveTvl = stUsdsData ? parseFloat(formatUnits(stUsdsData.totalAssets, 18)) : undefined;

  // Memoized: withLivePoint builds a fresh array whenever there is a live
  // value, and a fresh array makes recharts rebuild the path — any re-render
  // during the entrance draw would cut it short.
  const rateData = useMemo(() => withLivePoint(parsed.rate, liveRate), [parsed.rate, liveRate]);
  // The TVL series gets no live point: BA Labs' daily `stusds_tvl` is not the
  // module's on-chain `totalAssets` (measured 224.3M vs 209.0M on the same
  // day), so a trailing on-chain point drew a step off the end of the daily
  // series that read as a cliff on 1W (APP-563 #11). The headline keeps the
  // on-chain figure, matching the Details grid.
  const tvlData = parsed.tvl;

  return (
    <RateTvlDetailChart
      dataTestId="stusds-detail-chart"
      symbol="USDS"
      rate={{ data: rateData, isLoading, error, displayValue: liveRate }}
      tvl={{ data: tvlData, isLoading, error, displayValue: liveTvl }}
      tooltipLabel="Daily average"
      onTimeFrameChange={setTimeFrame}
    />
  );
}
