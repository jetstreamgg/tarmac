import { useStUsdsChartInfo } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseStUsdsChartData } from '../hooks/useParseStUsdsChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

enum ChartName {
  TVL = 'tvl',
  RATE = 'rate'
}

export function StUSDSChart() {
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.TVL);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: stUsdsChartInfo, isLoading, error } = useStUsdsChartInfo();
  const chartData = useParseStUsdsChartData(timeFrame, stUsdsChartInfo || []);

  const availableCharts = [ChartName.TVL, ChartName.RATE];

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value as ChartName)}>
            <TabsList className="flex">
              {availableCharts.map((chart, index) => (
                <TabsTrigger key={chart} position={index === 0 ? 'left' : 'right'} value={chart}>
                  <Trans>{chart === ChartName.TVL ? 'TVL' : 'Rate'}</Trans>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="stusds-chart"
          data={activeChart === ChartName.TVL ? chartData.tvl : chartData.rate}
          isLoading={isLoading}
          error={error}
          isPercentage={activeChart === ChartName.RATE}
          symbol={activeChart === ChartName.TVL ? 'USDS' : undefined}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
