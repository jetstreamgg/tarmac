import { useTokenChartInfo, TokenChartInfoParsed } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseTokenChartData } from '@/modules/ui/hooks/useParseTokenChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChainId } from 'wagmi';
import { getExpertModules, ExpertModule } from '../../advanced/helpers/expertModules';

function calculateCumulativeTotalSupply(tokenChartData: TokenChartInfoParsed[]) {
  if (!tokenChartData || tokenChartData.length === 0) return [];

  const mergedData = new Map<number, TokenChartInfoParsed>();

  tokenChartData.forEach(entry => {
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
function useExpertModulesChartInfo({ expertModules }: { expertModules: ExpertModule[] }) {
  // TODO: Loop through all expert modules when more are added
  // Currently only handling stUSDS
  const [stUsdsModule] = expertModules;

  const {
    data: stUsdsChartData,
    isLoading: isLoadingStUsds,
    error: errorStUsds
  } = useTokenChartInfo({
    tokenAddress: stUsdsModule?.tokenAddress
  });

  // When more modules are added, fetch their data and combine like this:
  const combinedChartData = stUsdsChartData ? [...stUsdsChartData] : [];

  // For now, just use stUSDS data
  const data = calculateCumulativeTotalSupply(combinedChartData || []);

  return {
    data,
    isLoading: isLoadingStUsds,
    error: errorStUsds
  };
}

export function ExpertChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');
  const chainId = useChainId();

  // Get all expert modules for the current chain
  const expertModules = getExpertModules(chainId);

  // Fetch and aggregate chart data for all expert modules
  const { data: expertModulesChartData, isLoading, error } = useExpertModulesChartInfo({ expertModules });

  const chartData = useParseTokenChartData(timeFrame, expertModulesChartData);

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
