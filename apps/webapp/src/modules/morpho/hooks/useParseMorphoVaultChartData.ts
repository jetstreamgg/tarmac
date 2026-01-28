import { useMemo } from 'react';
import { Data, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { MorphoVaultChartDataPoint } from '@jetstreamgg/sky-hooks';

export function useParseMorphoVaultChartData(
  timeFrame: TimeFrame,
  chartData: MorphoVaultChartDataPoint[]
): { tvl: Data[]; rate: Data[] } {
  // For TVL, use amount field
  const tvlData = useParseTvlChartData(timeFrame, chartData);

  // For Rate, transform the data to use apy field
  // APY is already a decimal (e.g., 0.05 for 5%), convert to bigint for the parser
  const rateChartData = useMemo(
    () =>
      chartData
        .filter(item => item.apy !== undefined && item.apy !== null)
        .map(item => ({
          blockTimestamp: item.blockTimestamp,
          // Convert APY decimal to bigint with 18 decimals (e.g., 0.05 -> 50000000000000000n)
          amount: BigInt(Math.round((item.apy as number) * 1e18))
        })),
    [chartData]
  );

  // Parse rate data using the TVL parser
  const parsedRateData = useParseTvlChartData(timeFrame, rateChartData);

  // Convert rate values to percentages for display
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
