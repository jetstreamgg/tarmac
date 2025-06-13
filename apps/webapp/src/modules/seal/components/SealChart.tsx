import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useParseSavingsChartData } from '@/modules/savings/hooks/useParseSavingsChartData';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useSealHistoricData } from '@jetstreamgg/sky-hooks';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { parseEther } from 'viem';

export function SealChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: sealChartInfo, isLoading, error } = useSealHistoricData();
  const formattedSealChartInfo = sealChartInfo?.map(item => {
    const normalizedSupply = Number(item.tvl).toFixed(18); //remove scientific notation if it exists
    return {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: parseEther(normalizedSupply)
    };
  });
  // We can reuse the useParseSavingsChartData hook here as the format of the data is the same
  const chartData = useParseSavingsChartData(timeFrame, formattedSealChartInfo || []);

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value)}>
            <TabsList className="flex">
              <TabsTrigger position="whole" value="tvl">
                <Trans>TVL (Sealed)</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="seal-chart"
          data={chartData}
          prefix="$"
          isLoading={isLoading}
          error={error}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
