import type { EarnProductKind, EarnProductRow } from '@/hooks';
import type { Intent } from '@/lib/enums';
import { projectAnnualEarnings } from '@/utils';
import { FALLBACK_TOKEN_COLOR, resolveTokenChartColors } from '@/widgets/shared/constants';

/**
 * One supplied position, decorated for the Portfolio "Supplied" tab. A product
 * held on several chains (sUSDS on Ethereum and Base, say) is several positions
 * — one per chain, each wearing its own network mark (APP-547) — so `id` is
 * unique per position while `rowId` names the product they share.
 */
export type SuppliedPosition = {
  /** `${rowId}:${chainId}` — unique per card, legend row and donut segment. */
  id: string;
  /** The marketplace row (registry product) — earnings and glyph lookups key on it. */
  rowId: string;
  /** Registry display name, e.g. 'Sky Savings Rate'. */
  name: string;
  tokenSymbol: string;
  kind: EarnProductKind;
  /** Module that owns the product (from the registry) — network rules, toast copy. */
  intent: Intent;
  /** Contract address for address-bound products (vaults/rewards/markets); undefined otherwise. */
  address?: `0x${string}`;
  amountUsd: number;
  /** Current rate as a decimal fraction (0.045 = 4.5%); undefined when the product has none. */
  rate?: number;
  /** The rate source is still loading — rate/earnings cells hold a skeleton instead of 0.00. */
  rateLoading: boolean;
  /** Brand color derived from the product's display token. */
  color: string;
  /** Hovered-segment color (DS Components/Charts-Hover); base color when the token has no hover variable. */
  hoverColor: string;
  /** Share of total supplied, 0..1. */
  share: number;
  /** In-app product page (registry route contract) — Supply/Manage destination. */
  detailPath: string;
  /** The chain this position lives on. Drives the network badge and the Supply target. */
  chainId: number;
  /**
   * The product runs on more than one chain (registry `networks`), so its legs
   * need telling apart — the legend shows a chain mark only for these. A
   * single-chain product's chain is implied and the mark would be noise.
   */
  multichain: boolean;
};

export type SuppliedView = {
  /** Positions with a positive amount, sorted by amount descending. */
  positions: SuppliedPosition[];
  totalSupplied: number;
  /** Σ amountUsd × rate (rate-less products contribute 0). */
  projected1Y: number;
  /** Supplied-weighted average rate, decimal fraction. */
  avgRate: number;
  /** A position's rate source is still loading — the aggregates above are premature. */
  ratesLoading: boolean;
  activePositions: number;
  /** Deduped display-token symbols across positions, in position order. */
  suppliedTokens: string[];
};

const EMPTY_VIEW: SuppliedView = {
  positions: [],
  totalSupplied: 0,
  projected1Y: 0,
  avgRate: 0,
  ratesLoading: false,
  activePositions: 0,
  suppliedTokens: []
};

/**
 * Breaks marketplace rows down into the Portfolio "Supplied" overview: one
 * position per chain a product holds a balance on, across the whole chain
 * family. Pure — no hooks, no fetching; consumes the same `useEarnMarketplace`
 * rows the Earn table renders, so the two agree.
 */
export function buildSuppliedView(rows: EarnProductRow[]): SuppliedView {
  if (rows.length === 0) return EMPTY_VIEW;

  // A product's per-chain legs, each a position of its own. Every producer
  // fills `byChain`; a row carrying only a total (test fixtures, a future
  // single-figure source) falls back to the product's first network so the
  // balance is never dropped.
  const legsFor = (row: EarnProductRow): { chainId: number; amountUsd: number }[] => {
    if (!row.position) return [];
    const legs = Object.entries(row.position.byChain ?? {})
      .map(([id, amountUsd]) => ({ chainId: Number(id), amountUsd }))
      .filter(({ amountUsd }) => amountUsd > 0);
    if (legs.length > 0) return legs;
    const fallbackChainId = row.networks[0];
    return fallbackChainId !== undefined && row.position.totalUsd > 0
      ? [{ chainId: fallbackChainId, amountUsd: row.position.totalUsd }]
      : [];
  };

  const withAmount = rows
    .flatMap(row => legsFor(row).map(leg => ({ row, ...leg })))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const totalSupplied = withAmount.reduce((acc, { amountUsd }) => acc + amountUsd, 0);

  const positions: SuppliedPosition[] = withAmount.map(({ row, chainId, amountUsd }) => ({
    id: `${row.id}:${chainId}`,
    rowId: row.id,
    name: row.name,
    tokenSymbol: row.tokenSymbol,
    kind: row.kind,
    intent: row.intent,
    address: row.address,
    amountUsd,
    rate: row.rate.value,
    rateLoading: row.rate.value === undefined && row.isLoading,
    ...(resolveTokenChartColors(row.tokenSymbol) ?? {
      color: FALLBACK_TOKEN_COLOR,
      hoverColor: FALLBACK_TOKEN_COLOR
    }),
    share: totalSupplied > 0 ? amountUsd / totalSupplied : 0,
    detailPath: row.detailPath,
    chainId,
    multichain: row.networks.length > 1
  }));

  const projected1Y = positions.reduce((acc, p) => acc + projectAnnualEarnings(p.amountUsd, p.rate), 0);

  return {
    positions,
    totalSupplied,
    projected1Y,
    avgRate: totalSupplied > 0 ? projected1Y / totalSupplied : 0,
    ratesLoading: positions.some(p => p.rateLoading),
    activePositions: positions.length,
    suppliedTokens: [...new Set(positions.map(p => p.tokenSymbol))]
  };
}
