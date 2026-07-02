import type { MorphoMarketAllocation } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';

/**
 * Segment colors for the Strategy allocation bar, cycled by index. Distinct,
 * brand-adjacent hues so adjacent market slices read apart.
 */
export const STRATEGY_COLORS = ['#7E6BF2', '#5AD293', '#4A9FF5', '#F17FBD', '#FFA74E', '#9B8AFB'];

export type StrategySegment = {
  /** Market id (stable key). */
  id: string;
  /** Display label, e.g. "stUSDS/USDC" (collateral/loan). */
  label: string;
  /** Compact USD, e.g. "$19.92M". */
  formattedUsd: string;
  /** Share of the strategy total, 0..1. */
  share: number;
  /** Rounded percentage, e.g. "49%". */
  formattedShare: string;
  /** Bar/legend color. */
  color: string;
};

export type VaultStrategyView = {
  /** Sum of the positive market allocations, in USD. */
  totalUsd: number;
  /** Compact USD total, e.g. "$39.92M". */
  formattedTotal: string;
  /** One segment per positive market allocation, largest first (input order). */
  segments: StrategySegment[];
};

/**
 * Derives the "Strategy" view (total + proportional segments) from a Morpho
 * vault's market allocations. Pure — no hooks. Zero/negative allocations are
 * dropped; shares are computed against the surviving total so the bar fills.
 */
export function buildVaultStrategy(markets: MorphoMarketAllocation[]): VaultStrategyView {
  const positive = markets.filter(market => market.assetsUsd > 0);
  const totalUsd = positive.reduce((sum, market) => sum + market.assetsUsd, 0);

  const segments: StrategySegment[] = positive.map((market, index) => {
    const share = totalUsd > 0 ? market.assetsUsd / totalUsd : 0;
    return {
      id: market.marketId,
      label: `${market.collateralAsset}/${market.loanAsset}`,
      formattedUsd: `$${formatNumber(market.assetsUsd, { compact: true })}`,
      share,
      formattedShare: formatDecimalPercentage(share, 0),
      color: STRATEGY_COLORS[index % STRATEGY_COLORS.length]
    };
  });

  return {
    totalUsd,
    formattedTotal: `$${formatNumber(totalUsd, { compact: true })}`,
    segments
  };
}
