import { MORPHO_VAULTS, useMorphoVaultMultipleChartInfo, useMorphoVaultsCombinedTvl } from '@jetstreamgg/sky-hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useState, useMemo } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseTvlChartData } from '@/modules/ui/hooks/useParseTvlChartData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
import { math } from '@jetstreamgg/sky-utils';

type TvlChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
};

const normalizeToDay = (data: TvlChartInfoParsed[]): TvlChartInfoParsed[] =>
  data.map(d => ({
    ...d,
    blockTimestamp: Math.floor(d.blockTimestamp / 86400) * 86400
  }));

const normalizeToHour = (data: TvlChartInfoParsed[]): TvlChartInfoParsed[] =>
  data.map(d => ({
    ...d,
    blockTimestamp: Math.floor(d.blockTimestamp / 3600) * 3600
  }));

function calculateCumulativeTotalSupply(chartData: TvlChartInfoParsed[]) {
  if (!chartData || chartData.length === 0) return [];

  const mergedData = new Map<number, TvlChartInfoParsed>();

  chartData.forEach(entry => {
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

function useVaultsChartInfo(useHourlyInterval?: boolean) {
  const vaultAddresses = MORPHO_VAULTS.map(vault => vault.vaultAddress[mainnet.id]) as `0x${string}`[];

  const {
    data: morphoChartData,
    isLoading,
    error
  } = useMorphoVaultMultipleChartInfo({ vaultAddresses, useHourlyInterval });

  const data = useMemo(() => {
    const normalize = useHourlyInterval ? normalizeToHour : normalizeToDay;
    const normalizedMorpho = (morphoChartData || []).flatMap((vaultData, index) => {
      if (!vaultData) return [];
      const vault = MORPHO_VAULTS[index];
      const decimals = math.resolveDecimals(vault.assetToken.decimals, mainnet.id);
      return normalize(vaultData).map(d => ({
        ...d,
        amount: math.scaleToBaseDecimals(d.amount, decimals)
      }));
    });

    return calculateCumulativeTotalSupply(normalizedMorpho);
  }, [morphoChartData, useHourlyInterval]);

  return { data, isLoading, error };
}

export function VaultsChart() {
  const [activeChart, setActiveChart] = useState('tvl');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const useHourlyInterval = timeFrame === 'w' || timeFrame === 'm';
  const intervalOverride = useHourlyInterval ? 3600 : undefined;

  const { data: vaultsChartData, isLoading, error } = useVaultsChartInfo(useHourlyInterval);
  const { totalAssetsScaled, isLoading: isCombinedTvlLoading } = useMorphoVaultsCombinedTvl();

  const parsedChartData = useParseTvlChartData(timeFrame, vaultsChartData, undefined, intervalOverride);

  // Append live data point to chart data
  const chartData = useMemo(() => {
    if (isCombinedTvlLoading || parsedChartData.length === 0) return parsedChartData;
    return [
      ...parsedChartData,
      {
        value: parseFloat(formatUnits(totalAssetsScaled, 18)),
        date: new Date(),
        tooltipLabel: 'Current value'
      }
    ];
  }, [parsedChartData, totalAssetsScaled, isCombinedTvlLoading]);

  const tooltipLabel = useHourlyInterval ? 'Hourly average' : 'Daily average';

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
          dataTestId="vaults-chart"
          data={chartData}
          isLoading={isLoading}
          error={error}
          symbol={'USDS'}
          tooltipLabel={tooltipLabel}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
