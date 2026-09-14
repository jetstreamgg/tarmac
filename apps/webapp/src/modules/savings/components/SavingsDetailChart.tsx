import { useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { useSavingsChartInfo, useSkySavingsRateHistoricData, useOverallSkyData } from '@/hooks';
import { isL2ChainId } from '@/utils';
import { TimeFrame, Data } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { RateTvlDetailChart } from '@/components/product/RateTvlDetailChart';

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
 * ProductDetailTemplate's `chart` slot. Owns the timeframe state (it drives the
 * row budget of both series) and feeds the shared `RateTvlDetailChart`.
 */
export function SavingsDetailChart() {
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

  // Headline reads the canonical current rate (matches the Details grid), not
  // the last historic point.
  const currentRate = overall?.skySavingsRatecRate
    ? parseFloat(overall.skySavingsRatecRate) * 100
    : undefined;

  return (
    <RateTvlDetailChart
      dataTestId="savings-detail-chart"
      symbol="sUSDS"
      rate={{ data: rateData, isLoading: rateLoading, error: rateError, displayValue: currentRate }}
      tvl={{ data: tvlData, isLoading: tvlLoading, error: tvlError }}
      onTimeFrameChange={setTimeFrame}
    />
  );
}
