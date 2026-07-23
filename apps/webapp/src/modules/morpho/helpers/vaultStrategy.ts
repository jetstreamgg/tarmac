import type { MorphoIdleLiquidityAllocation, MorphoMarketAllocation } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';

/**
 * Segment colors for the Strategy allocation bar, cycled by index. Distinct,
 * brand-adjacent hues so adjacent market slices read apart.
 */
export const STRATEGY_COLORS = ['#7E6BF2', '#5AD293', '#4A9FF5', '#F17FBD', '#FFA74E', '#9B8AFB'];

/** Muted fill for the idle-capital segment — visually "parked", not a strategy. */
export const IDLE_COLOR = '#8A8FA8';

export type StrategySegment = {
  /** Market id (stable key), or `idle-<asset>` for the idle segment. */
  id: string;
  /** Display label, e.g. "stUSDS/USDC" (collateral/loan), or "Idle". */
  label: string;
  /** Compact USD, e.g. "$19.92M". */
  formattedUsd: string;
  /** Share of the vault total, 0..1. */
  share: number;
  /** Rounded percentage, e.g. "49%". */
  formattedShare: string;
  /** Bar/legend color. */
  color: string;
};

export type VaultStrategyView = {
  /** Total vault capital in USD (falls back to the segment sum when unknown). */
  totalUsd: number;
  /** Compact USD total, e.g. "$39.92M". */
  formattedTotal: string;
  /** One segment per positive allocation (markets, then idle), input order. */
  segments: StrategySegment[];
};

/**
 * Derives the "Strategy" view (total + proportional segments) from a Morpho
 * vault's market allocations. Pure — no hooks. Zero/negative allocations are
 * dropped. Idle capital renders as its own segment (APP-399 #8), and shares are
 * computed against the vault's total capital (`totalAssetsUsd`) so each percent
 * is capital-in-market vs the entire vault — not vs the allocated subset. When
 * the total is unknown (or smaller than the segment sum, e.g. a stale API
 * total), shares fall back to the segment sum so the bar never overflows.
 */
export function buildVaultStrategy(
  markets: MorphoMarketAllocation[],
  idleLiquidity: MorphoIdleLiquidityAllocation[] = [],
  totalAssetsUsd?: number
): VaultStrategyView {
  const positive = markets.filter(market => market.assetsUsd > 0);
  const idlePositive = idleLiquidity.filter(idle => idle.idleAssetsUsd > 0);

  const segmentSumUsd =
    positive.reduce((sum, market) => sum + market.assetsUsd, 0) +
    idlePositive.reduce((sum, idle) => sum + idle.idleAssetsUsd, 0);
  const totalUsd =
    totalAssetsUsd !== undefined && totalAssetsUsd >= segmentSumUsd ? totalAssetsUsd : segmentSumUsd;

  const toSegment = (id: string, label: string, usd: number, color: string): StrategySegment => {
    const share = totalUsd > 0 ? usd / totalUsd : 0;
    return {
      id,
      label,
      formattedUsd: `$${formatNumber(usd, { compact: true })}`,
      share,
      formattedShare: formatDecimalPercentage(share, 0),
      color
    };
  };

  const segments: StrategySegment[] = [
    ...positive.map((market, index) =>
      toSegment(
        market.marketId,
        `${market.collateralAsset}/${market.loanAsset}`,
        market.assetsUsd,
        STRATEGY_COLORS[index % STRATEGY_COLORS.length]
      )
    ),
    ...idlePositive.map(idle => toSegment(`idle-${idle.assetSymbol}`, 'Idle', idle.idleAssetsUsd, IDLE_COLOR))
  ];

  return {
    totalUsd,
    formattedTotal: `$${formatNumber(totalUsd, { compact: true })}`,
    segments
  };
}
