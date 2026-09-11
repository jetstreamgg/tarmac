import { useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, useMorphoVaultChartInfo, useVaultMarketData, type Token } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { useParseVaultChartData } from '../hooks/useParseVaultChartData';
import { hasRateBreakdown, VaultRateMark, VaultRateTooltip } from './VaultRateBreakdown';

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
        label={isRate ? <Trans>Current Rate</Trans> : <Trans>Total value locked</Trans>}
        // The TVL metric leads its figure with the token mark instead of a
        // trailing ticker and tags it with the period's change, the same
        // recipe the portfolio totals chart wears (APP-552, Figma 2800:92438).
        icons={
          isRate ? undefined : <TokenIconStack symbols={[assetToken.symbol]} size={32} className="shrink-0" />
        }
        showTrend={!isRate}
        displayValue={isRate ? liveRate : liveTvl}
        // The headline plots the same net rate the card and Details row show,
        // so it wears the same stars mark and breakdown tooltip (APP-443 item
        // 14). TVL is not a rate — no mark on that metric. The mark is 16px
        // here rather than the 12px the comps draw beside 14–18px text: no comp
        // pins it against this 44px figure, and 12px reads as a speck.
        valueSuffix={
          isRate && hasRateBreakdown(marketData?.rate) ? (
            <VaultRateTooltip rate={marketData?.rate}>
              <VaultRateMark className="size-4" />
            </VaultRateTooltip>
          ) : undefined
        }
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
