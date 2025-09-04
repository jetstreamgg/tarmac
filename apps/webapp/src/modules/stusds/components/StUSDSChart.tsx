import { useStUsdsChartInfo } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseSavingsChartData } from '@/modules/savings/hooks/useParseSavingsChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function StUSDSChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: stUsdsChartInfo, isLoading, error } = useStUsdsChartInfo();
  const chartData = useParseSavingsChartData(timeFrame, stUsdsChartInfo || []);

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
          dataTestId="stusds-chart"
          data={chartData}
          isLoading={isLoading}
          error={error}
          symbol={'stUSDS'}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
