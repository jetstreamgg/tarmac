import type { MorphoIdleLiquidityAllocation, MorphoMarketAllocation } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { CHART_GENERIC_COLORS, resolveTokenChartColors } from '@/widgets/shared/constants';

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
  /** Bar/legend color (DS Components/Charts). */
  color: string;
  /** Hovered-segment color (DS Components/Charts-Hover). */
  hoverColor: string;
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

  const toSegment = (
    id: string,
    label: string,
    usd: number,
    colors: { color: string; hoverColor: string }
  ): StrategySegment => {
    const share = totalUsd > 0 ? usd / totalUsd : 0;
    return {
      id,
      label,
      formattedUsd: `$${formatNumber(usd, { compact: true })}`,
      share,
      formattedShare: formatDecimalPercentage(share, 0),
      ...colors
    };
  };

  // Collaterals with a DS chart variable (Components/Charts/bg-*, Figma
  // 5270:15609 — APP-416) use it, keeping the bar in agreement with the pie
  // chart and legends; the rest cycle the DS generic chart1/chart2 slots.
  const segments: StrategySegment[] = [
    ...positive.map((market, index) =>
      toSegment(
        market.marketId,
        `${market.collateralAsset}/${market.loanAsset}`,
        market.assetsUsd,
        resolveTokenChartColors(market.collateralAsset) ??
          CHART_GENERIC_COLORS[index % CHART_GENERIC_COLORS.length]
      )
    ),
    ...idlePositive.map(idle =>
      toSegment(`idle-${idle.assetSymbol}`, 'Idle', idle.idleAssetsUsd, {
        color: IDLE_COLOR,
        hoverColor: IDLE_COLOR
      })
    )
  ];

  return {
    totalUsd,
    formattedTotal: `$${formatNumber(totalUsd, { compact: true })}`,
    segments
  };
}
