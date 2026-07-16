import { useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, useMorphoVaultChartInfo, useVaultMarketData, type Token } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useParseVaultChartData } from '../hooks/useParseVaultChartData';

type Metric = 'rate' | 'tvl';

const LIVE_LABEL = 'Current value';

/**
 * The product-detail Rate/TVL chart for a Morpho vault — injected into
 * ProductDetailTemplate's `chart` slot. Same data pipeline as the legacy
 * `MorphoVaultChart` (`useMorphoVaultChartInfo` history + `useVaultMarketData`
 * live point), rendered through the shared Chart's `detail` variant (metric +
 * timeframe pills, glass panel, no x-axis) — mirroring `SavingsDetailChart`.
 */
export function VaultDetailChart({
  vaultAddress,
  assetToken
}: {
  vaultAddress: `0x${string}`;
  assetToken: Token;
}) {
  const chainId = useChainId();
  const [metric, setMetric] = useState<Metric>('rate');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const useHourlyInterval = timeFrame === 'w' || timeFrame === 'm';
  const hourlyWindow = useHourlyInterval ? timeFrame : undefined;

  const {
    data: chartInfo,
    isLoading,
    error
  } = useMorphoVaultChartInfo({
    vaultAddress,
    useHourlyInterval,
    hourlyWindow
  });
  const { data: marketData } = useVaultMarketData({ provider: 'morpho', vaultAddress });

  const decimals = getTokenDecimals(assetToken, chainId);
  const parsed = useParseVaultChartData(timeFrame, chartInfo || [], decimals, useHourlyInterval);

  const isRate = metric === 'rate';

  // Headline + live trailing point come from the canonical market data (matches
  // the Details grid), appended to the historic series.
  const liveTvl =
    marketData?.totalAssets !== undefined
      ? parseFloat(formatUnits(marketData.totalAssets, decimals))
      : undefined;
  const liveRate = marketData?.rate ? marketData.rate.netRate * 100 : undefined;

  const rateData =
    liveRate !== undefined && parsed.rate.length > 0
      ? [...parsed.rate, { value: liveRate, date: new Date(), tooltipLabel: LIVE_LABEL }]
      : parsed.rate;
  const tvlData =
    liveTvl !== undefined && parsed.tvl.length > 0
      ? [...parsed.tvl, { value: liveTvl, date: new Date(), tooltipLabel: LIVE_LABEL }]
      : parsed.tvl;

  return (
    <ErrorBoundary variant="small">
      <Chart
        variant="detail"
        dataTestId="vault-detail-chart"
        data={isRate ? rateData : tvlData}
        isLoading={isLoading}
        error={error}
        isPercentage={isRate}
        hidePercentChange={isRate}
        symbol={isRate ? undefined : assetToken.symbol}
        tokenSymbols={isRate ? undefined : [assetToken.symbol]}
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>TVL</Trans>}
        displayValue={isRate ? liveRate : liveTvl}
        tooltipLabel={useHourlyInterval ? 'Hourly average' : 'Daily average'}
        metrics={[
          { value: 'rate', label: <Trans>Rate</Trans> },
          { value: 'tvl', label: <Trans>TVL</Trans> }
        ]}
        activeMetric={metric}
        onMetricChange={value => setMetric(value as Metric)}
        onTimeFrameChange={setTimeFrame}
      />
    </ErrorBoundary>
  );
}
