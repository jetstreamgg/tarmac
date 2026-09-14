import { useState } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { getTokenDecimals, useMorphoVaultChartInfo, useVaultMarketData, type Token } from '@/hooks';
import { TimeFrame } from '@/modules/ui/components/Chart';
import { RateTvlDetailChart, withLivePoint } from '@/components/product/RateTvlDetailChart';
import { useParseVaultChartData } from '../hooks/useParseVaultChartData';
import { hasRateBreakdown, VaultRateMark, VaultRateTooltip } from './VaultRateBreakdown';

/**
 * The product-detail Rate/TVL chart for a Morpho vault — injected into
 * ProductDetailTemplate's `chart` slot. Same data pipeline as the legacy
 * `MorphoVaultChart` (`useMorphoVaultChartInfo` history + `useVaultMarketData`
 * live point), rendered through the shared `RateTvlDetailChart` (metric +
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

  // Headline + live trailing point come from the canonical market data (matches
  // the Details grid), appended to the historic series.
  const liveTvl =
    marketData?.totalAssets !== undefined
      ? parseFloat(formatUnits(marketData.totalAssets, decimals))
      : undefined;
  const liveRate = marketData?.rate ? marketData.rate.netRate * 100 : undefined;

  const rateData = withLivePoint(parsed.rate, liveRate);
  const tvlData = withLivePoint(parsed.tvl, liveTvl);

  return (
    <RateTvlDetailChart
      dataTestId="vault-detail-chart"
      symbol={assetToken.symbol}
      rate={{ data: rateData, isLoading, error, displayValue: liveRate }}
      tvl={{ data: tvlData, isLoading, error, displayValue: liveTvl }}
      hideRatePercentChange
      // The headline plots the same net rate the card and Details row show,
      // so it wears the same stars mark and breakdown tooltip (APP-443 item
      // 14). TVL is not a rate — no mark on that metric. The mark is 16px
      // here rather than the 12px the comps draw beside 14–18px text: no comp
      // pins it against this 44px figure, and 12px reads as a speck.
      rateValueSuffix={
        hasRateBreakdown(marketData?.rate) ? (
          <VaultRateTooltip rate={marketData?.rate}>
            <VaultRateMark className="size-4" />
          </VaultRateTooltip>
        ) : undefined
      }
      tooltipLabel={useHourlyInterval ? 'Hourly average' : 'Daily average'}
      onTimeFrameChange={setTimeFrame}
    />
  );
}
