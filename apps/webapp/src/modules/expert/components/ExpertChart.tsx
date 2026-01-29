import {
  useStUsdsChartInfo,
  useMorphoVaultChartInfo,
  usdsRiskCapitalVaultAddress
} from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState, useMemo } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mainnet } from 'viem/chains';

type TvlChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
};

const normalizeToDay = (data: TvlChartInfoParsed[]): TvlChartInfoParsed[] =>
  data.map(d => ({
    ...d,
    blockTimestamp: Math.floor(d.blockTimestamp / 86400) * 86400
  }));

function calculateCumulativeTotalSupply(chartData: TvlChartInfoParsed[]) {
  if (!chartData || chartData.length === 0) return [];

  const mergedData = new Map<number, TvlChartInfoParsed>();

  chartData.forEach(entry => {
    const foundData = mergedData.get(entry.blockTimestamp);
    if (foundData) {
      mergedData.set(entry.blockTimestamp, {
        ...foundData,
        amount: foundData.amount + entry.amount
      });
    } else {
      mergedData.set(entry.blockTimestamp, entry);
    }
  });

  return [...mergedData.values()].sort((a, b) => a.blockTimestamp - b.blockTimestamp);
}

// Hook to fetch and aggregate expert modules chart data
function useExpertModulesChartInfo() {
  const { data: stUsdsChartData, isLoading: isLoadingStUsds, error: errorStUsds } = useStUsdsChartInfo();
  const {
    data: morphoChartData,
    isLoading: isLoadingMorpho,
    error: errorMorpho
  } = useMorphoVaultChartInfo({
    // Morpho API is mainnet-only
    vaultAddress: usdsRiskCapitalVaultAddress[mainnet.id]
  });

  // Normalize timestamps to day boundaries, combine, and aggregate
  const data = useMemo(() => {
    const combined = [...normalizeToDay(stUsdsChartData || []), ...normalizeToDay(morphoChartData || [])];
    return calculateCumulativeTotalSupply(combined);
  }, [stUsdsChartData, morphoChartData]);

  return {
    data,
    isLoading: isLoadingStUsds || isLoadingMorpho,
    error: errorStUsds || errorMorpho
  };
}

export function ExpertChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  // Fetch and aggregate chart data for all expert modules
  const { data: expertModulesChartData, isLoading, error } = useExpertModulesChartInfo();

  const chartData = useParseTvlChartData(timeFrame, expertModulesChartData);

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value)}>
            <TabsList className="flex">
              <TabsTrigger position="whole" value="tvl">
                <Trans>TVL</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="expert-chart"
          data={chartData}
          isLoading={isLoading}
          error={error}
          symbol={'USDS'}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
