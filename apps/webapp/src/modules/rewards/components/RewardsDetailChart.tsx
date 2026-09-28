import { useState } from 'react';
import { useRewardsChartInfo, type RewardContract } from '@/hooks';
import { TimeFrame } from '@/modules/ui/components/Chart';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { RateTvlDetailChart } from '@/components/product/RateTvlDetailChart';
import { useParseRewardsChartData } from '../hooks/useParseRewardsChartData';

/**
 * The product-detail Rate/TVL chart for a reward farm — injected into
 * ProductDetailTemplate's `chart` slot. Owns the timeframe state and feeds the
 * shared `RateTvlDetailChart`. Both series come from the one
 * BA Labs farms endpoint (`useRewardsChartInfo`), parsed through the existing
 * `useParseRewardsChartData` pipeline.
 *
 * Farms without a live rate (Chronicle points, the deprecated SKY farm) hide
 * the Rate tab and render TVL only — same behaviour as the legacy details pane.
 */
export function RewardsDetailChart({
  contract,
  currentRate
}: {
  contract: RewardContract;
  /** Latest rate as a decimal fraction; undefined/0 hides the Rate metric. */
  currentRate?: number;
}) {
  const hasRate = (currentRate ?? 0) > 0;
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const {
    data: chartInfo,
    isLoading,
    error
  } = useRewardsChartInfo({
    rewardContractAddress: contract.contractAddress,
    limit: getDayCountFromTimeFrame(timeFrame)
  });
  const { totalSupplied: tvlData, rate: rateData } = useParseRewardsChartData(timeFrame, chartInfo || []);

  return (
    <RateTvlDetailChart
      dataTestId="rewards-detail-chart"
      symbol={contract.supplyToken.symbol}
      rate={{
        data: rateData,
        isLoading,
        error,
        // Headline reads the canonical current rate (matches the Details grid),
        // not the last historic point.
        displayValue: currentRate !== undefined ? currentRate * 100 : undefined
      }}
      tvl={{ data: tvlData, isLoading, error }}
      hideRate={!hasRate}
      onTimeFrameChange={setTimeFrame}
    />
  );
}
