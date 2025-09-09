import { useMemo } from 'react';
import { Data, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';

type StUsdsChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
  rate?: bigint;
};

export function useParseStUsdsChartData(
  timeFrame: TimeFrame,
  chartData: StUsdsChartInfoParsed[]
): { tvl: Data[]; rate: Data[] } {
  // For TVL, use amount field
  const tvlData = useParseTvlChartData(timeFrame, chartData);

  // For rate, transform the data to use rate field as amount
  const rateChartData = useMemo(
    () =>
      chartData
        .filter(item => item.rate !== undefined && item.rate !== null)
        .map(item => ({
          blockTimestamp: item.blockTimestamp,
          amount: item.rate as bigint // Use rate as amount for the parser
        })),
    [chartData]
  );

  // Parse rate data
  const parsedRateData = useParseTvlChartData(timeFrame, rateChartData);

  // Convert rate values to percentages
  const rateData = useMemo(
    () =>
      parsedRateData.map(point => ({
        ...point,
        value: point.value * 100 // Convert from decimal (0.045) to percentage (4.5)
      })),
    [parsedRateData]
  );

  return { tvl: tvlData, rate: rateData };
}
