import { useMorphoVaultChartInfo, Token } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseMorphoVaultChartData } from '../hooks/useParseMorphoVaultChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChainId } from 'wagmi';

enum ChartName {
  TVL = 'tvl',
  RATE = 'rate'
}

type MorphoVaultChartProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultChart({ vaultAddress, assetToken }: MorphoVaultChartProps) {
  const chainId = useChainId();
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.TVL);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const { data: chartInfo, isLoading, error } = useMorphoVaultChartInfo({ vaultAddress });
  const decimals = typeof assetToken.decimals === 'number' ? assetToken.decimals : assetToken.decimals[chainId];
  const chartData = useParseMorphoVaultChartData(timeFrame, chartInfo || [], decimals);

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
          dataTestId="morpho-vault-chart"
          data={activeChart === ChartName.TVL ? chartData.tvl : chartData.rate}
          isLoading={isLoading}
          error={error}
          isPercentage={activeChart === ChartName.RATE}
          hidePercentChange={activeChart === ChartName.RATE}
          symbol={activeChart === ChartName.TVL ? assetToken.symbol : undefined}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
