import { RewardContract, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useParseRewardsChartData } from '@/modules/rewards/hooks/useParseRewardsChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';

enum ChartName {
  TVL = 'TVL',
  RATE = 'RATE'
}

export function RewardsCharts({ rewardContract }: { rewardContract: RewardContract }) {
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.TVL);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');
  const limit = getDayCountFromTimeFrame(timeFrame);

  const {
    data: rewardContractChartData,
    isLoading,
    error
  } = useRewardsChartInfo({
    rewardContractAddress: rewardContract.contractAddress.toLowerCase(),
    ...(limit !== undefined && { limit })
  });

  const chartData = useParseRewardsChartData(timeFrame, rewardContractChartData || []);

  // Only show Rate if there is a >0 Rate to show
  const showRate = chartData.rate.length > 0 && chartData.rate[chartData.rate.length - 1].value !== 0;
  const availableCharts = [ChartName.TVL, ...(showRate ? [ChartName.RATE] : [])];

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value as ChartName)}>
            <TabsList className="flex">
              {availableCharts.map((chart, index) => (
                <TabsTrigger
                  key={chart}
                  position={availableCharts.length === 1 ? 'whole' : index === 0 ? 'left' : 'right'}
                  value={chart}
                >
                  <Trans>{chart}</Trans>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="reward-contract-chart"
          data={activeChart === ChartName.TVL ? chartData.totalSupplied : chartData.rate}
          isLoading={isLoading}
          isPercentage={activeChart === ChartName.TVL ? false : true}
          symbol={rewardContract.supplyToken.symbol}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
          error={error}
        />
      </ErrorBoundary>
    </div>
  );
}
