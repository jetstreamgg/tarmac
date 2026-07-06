import { useMorphoVaultChartInfo, useVaultMarketData, Token, VaultProvider } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState, useMemo } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseVaultChartData } from '../hooks/useParseVaultChartData';
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
  /** Vault provider; defaults to Morpho for back-compat. */
  provider?: VaultProvider;
};

export function MorphoVaultChart({ vaultAddress, assetToken, provider = 'morpho' }: MorphoVaultChartProps) {
  const chainId = useChainId();
  const isMorpho = provider === 'morpho';
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.TVL);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const useHourlyInterval = timeFrame === 'w' || timeFrame === 'm';
  const hourlyWindow = timeFrame === 'w' || timeFrame === 'm' ? timeFrame : undefined;

  // Morpho fetches its history series from the dedicated chart endpoint; disabled
  // for other providers so a non-Morpho vault never hits the Morpho API.
  const {
    data: morphoChartInfo,
    isLoading: morphoLoading,
    error: morphoError
  } = useMorphoVaultChartInfo({
    vaultAddress,
    useHourlyInterval,
    hourlyWindow,
    enabled: isMorpho
  });

  // Provider-neutral market data: the live point for both providers, plus the
  // history series for non-Morpho providers (Spark carries it in this payload).
  const {
    data: marketData,
    isLoading: marketLoading,
    error: marketError
  } = useVaultMarketData({
    provider,
    vaultAddress
  });

  // For Morpho the history comes from the chart endpoint; otherwise from the
  // normalized market-data payload.
  const chartInfo = isMorpho ? morphoChartInfo : (marketData?.history ?? []);
  const isLoading = isMorpho ? morphoLoading : marketLoading;
  const error = isMorpho ? morphoError : marketError;

  const decimals =
    typeof assetToken.decimals === 'number' ? assetToken.decimals : assetToken.decimals[chainId];
  const parsedChartData = useParseVaultChartData(timeFrame, chartInfo || [], decimals, useHourlyInterval);

  const displayValue = useMemo(() => {
    if (!marketData) return undefined;
    if (activeChart === ChartName.TVL) {
      return marketData.totalAssets !== undefined
        ? parseFloat(formatUnits(marketData.totalAssets, decimals))
        : undefined;
    }
    return marketData.rate ? marketData.rate.netRate * 100 : undefined;
  }, [marketData, activeChart, decimals]);

  // Append live data point to chart data
  const chartData = useMemo(() => {
    const liveLabel = 'Current value';
    const tvl =
      marketData?.totalAssets !== undefined && parsedChartData.tvl.length > 0
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
      marketData?.rate && parsedChartData.rate.length > 0
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
          dataTestId={`${provider}-vault-chart`}
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
