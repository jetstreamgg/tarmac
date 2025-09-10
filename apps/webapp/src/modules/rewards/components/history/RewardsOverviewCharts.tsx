import { RewardContract, RewardsChartInfoParsed, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
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

function calculateCumulativeTotalSupplied(rewardChartData: RewardsChartInfoParsed[]) {
  if (!rewardChartData || rewardChartData.length === 0) return [];

  const mergedData = new Map<number, RewardsChartInfoParsed>();

  rewardChartData.forEach(entry => {
    const foundData = mergedData.get(entry.blockTimestamp);
    if (foundData) {
      mergedData.set(entry.blockTimestamp, {
        ...foundData,
        totalSupplied: (parseFloat(foundData.totalSupplied) + parseFloat(entry.totalSupplied)).toString()
      });
    } else {
      mergedData.set(entry.blockTimestamp, entry);
    }
  });

  return [...mergedData.values()].sort((a, b) => a.blockTimestamp - b.blockTimestamp);
}

// TODO: Move this logic to helipad
function useRewardListChartInfo({
  rewardContracts,
  timeFrame
}: {
  rewardContracts: RewardContract[];
  timeFrame: TimeFrame;
}) {
  // TODO: need to do this in a loop rather than hardcoding reward contracts
  const [skyRewardContract, cronRewardContract] = rewardContracts;
  const limit = getDayCountFromTimeFrame(timeFrame);

  const {
    data: skyChartData,
    isLoading: isLoadingSky,
    error: errorSky
  } = useRewardsChartInfo({
    rewardContractAddress: skyRewardContract.contractAddress.toLowerCase(),
    ...(limit !== undefined && { limit })
  });

  const {
    data: cronChartData,
    isLoading: isLoadingCron,
    error: errorCron
  } = useRewardsChartInfo({
    rewardContractAddress: cronRewardContract.contractAddress.toLowerCase(),
    ...(limit !== undefined && { limit })
  });
  const combinedChartData = skyChartData && cronChartData ? [...skyChartData, ...cronChartData] : [];

  // Merges the reward contracts data and calculates total supplied
  const data = calculateCumulativeTotalSupplied(combinedChartData);

  return {
    data,
    isLoading: isLoadingSky || isLoadingCron,
    error: errorSky || errorCron
  };
}

export function RewardsOverviewCharts({ rewardContracts }: { rewardContracts: RewardContract[] }) {
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.TVL);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: rewardsChartData, isLoading, error } = useRewardListChartInfo({ rewardContracts, timeFrame });

  const chartData = useParseRewardsChartData(timeFrame, rewardsChartData || []);

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value as ChartName)}>
            <TabsList className="flex">
              <TabsTrigger position="whole" value="TVL">
                <Trans>TVL</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="rewards-overview-chart"
          data={chartData.totalSupplied}
          isLoading={isLoading}
          // Note this chart only displays rewards with USDS supply token
          symbol={'USDS'}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
          error={error}
        />
      </ErrorBoundary>
    </div>
  );
}
