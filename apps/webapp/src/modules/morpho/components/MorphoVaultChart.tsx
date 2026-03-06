import { useMorphoVaultChartInfo, useMorphoVaultMarketApiData, Token } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState, useMemo } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseMorphoVaultChartData } from '../hooks/useParseMorphoVaultChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';

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

  const useHourlyInterval = timeFrame === 'w' || timeFrame === 'm';

  const { data: chartInfo, isLoading, error } = useMorphoVaultChartInfo({ vaultAddress, useHourlyInterval });
  const { data: marketData } = useMorphoVaultMarketApiData({ vaultAddress });
  const decimals = typeof assetToken.decimals === 'number' ? assetToken.decimals : assetToken.decimals[chainId];
  const parsedChartData = useParseMorphoVaultChartData(timeFrame, chartInfo || [], decimals, useHourlyInterval);

  const displayValue = useMemo(() => {
    if (!marketData) return undefined;
    if (activeChart === ChartName.TVL) {
      return parseFloat(formatUnits(marketData.totalAssets, decimals));
    }
    return marketData.rate.netRate * 100;
  }, [marketData, activeChart, decimals]);

  // Append live data point to chart data
  const chartData = useMemo(() => {
    const liveLabel = 'Current value';
    const tvl =
      marketData && parsedChartData.tvl.length > 0
        ? [
            ...parsedChartData.tvl,
            {
              value: parseFloat(formatUnits(marketData.totalAssets, decimals)),
              date: new Date(),
              tooltipLabel: liveLabel
            }
          ]
        : parsedChartData.tvl;

    const rate =
      marketData && parsedChartData.rate.length > 0
        ? [
            ...parsedChartData.rate,
            {
              value: marketData.rate.netRate * 100,
              date: new Date(),
              tooltipLabel: liveLabel
            }
          ]
        : parsedChartData.rate;

    return { tvl, rate };
  }, [parsedChartData, marketData, decimals]);

  const tooltipLabel = useHourlyInterval ? 'Hourly average' : 'Daily average';

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
          displayValue={displayValue}
          tooltipLabel={tooltipLabel}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
