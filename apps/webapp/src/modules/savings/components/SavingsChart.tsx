import { useSavingsChartInfo } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/sky-utils';

export function SavingsChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');
  const chainId = useChainId();
  const isL2Chain = isL2ChainId(chainId);
  const chartChainId = isL2Chain ? 1 : chainId; // use mainnet for L2s

  const { data: savingsChartInfo, isLoading, error } = useSavingsChartInfo(chartChainId);
  const chartData = useParseTvlChartData(timeFrame, savingsChartInfo || []);

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
          dataTestId="savings-chart"
          data={chartData}
          isLoading={isLoading}
          error={error}
          symbol={'sUSDS'}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
