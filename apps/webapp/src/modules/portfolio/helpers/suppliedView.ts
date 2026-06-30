import type { EarnProductKind, EarnProductRow } from '@/hooks';
import { projectAnnualEarnings } from '@/utils';
import { resolveTokenColor } from '@/widgets/shared/constants';

/** One supplied position, decorated for the Portfolio "Supplied" tab. */
export type SuppliedPosition = {
  id: string;
  /** Registry display name, e.g. 'Sky Savings Rate'. */
  name: string;
  tokenSymbol: string;
  kind: EarnProductKind;
  /** Contract address for address-bound products (vaults/rewards/markets); undefined otherwise. */
  address?: `0x${string}`;
  amountUsd: number;
  /** Current rate as a decimal fraction (0.045 = 4.5%); undefined when the product has none. */
  rate?: number;
  /** Brand color derived from the product's display token. */
  color: string;
  /** Share of total supplied, 0..1. */
  share: number;
  /** In-app product page (registry route contract) — Supply/Manage destination. */
  detailPath: string;
  /**
   * Chains where this position holds a balance, scoped to the active filter:
   * `'all'` → every `byChain` key with a positive amount; a specific chain →
   * just that chain (the position only made the cut because it has a balance
   * there). Drives the stacked network badge. Sorted ascending.
   */
  chainIds: number[];
};

export type SuppliedView = {
  /** Positions with a positive amount, sorted by amount descending. */
  positions: SuppliedPosition[];
  totalSupplied: number;
  /** Σ amountUsd × rate (rate-less products contribute 0). */
  projected1Y: number;
  /** Supplied-weighted average rate, decimal fraction. */
  avgRate: number;
  activePositions: number;
  /** Deduped display-token symbols across positions, in position order. */
  suppliedTokens: string[];
  /** Chain ids where the user holds any supplied position (filter options). */
  networksWithPositions: number[];
};

const EMPTY_VIEW: SuppliedView = {
  positions: [],
  totalSupplied: 0,
  projected1Y: 0,
  avgRate: 0,
  activePositions: 0,
  suppliedTokens: [],
  networksWithPositions: []
};

/**
 * Aggregates marketplace rows into the Portfolio "Supplied" overview, scoped to
 * a single chain or the whole family. Pure — no hooks, no fetching; consumes
 * the same `useEarnMarketplace` rows the Earn table renders, so the two agree.
 *
 * @param network a chain id to scope to (uses `position.byChain`), or `'all'`
 *   for the family total (`position.totalUsd`).
 */
export function buildSuppliedView(rows: EarnProductRow[], network: number | 'all'): SuppliedView {
  if (rows.length === 0) return EMPTY_VIEW;

  const amountFor = (row: EarnProductRow): number => {
    if (!row.position) return 0;
    return network === 'all' ? row.position.totalUsd : (row.position.byChain?.[network] ?? 0);
  };

  // 'all' → the chains this position actually holds a balance on; a specific
  // chain → just that chain (the row only survives the filter with a balance
  // there). Always sorted, for a stable badge order.
  const chainsFor = (row: EarnProductRow): number[] => {
    if (network !== 'all') return [network];
    return Object.entries(row.position?.byChain ?? {})
      .filter(([, usd]) => usd > 0)
      .map(([id]) => Number(id))
      .sort((a, b) => a - b);
  };

  // Network options come from the full (unfiltered) byChain map so selecting a
  // network never removes the option you'd need to switch back from.
  const networkSet = new Set<number>();
  for (const row of rows) {
    for (const [id, usd] of Object.entries(row.position?.byChain ?? {})) {
      if (usd > 0) networkSet.add(Number(id));
    }
  }

  const withAmount = rows
    .map(row => ({ row, amountUsd: amountFor(row) }))
    .filter(({ amountUsd }) => amountUsd > 0)
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const totalSupplied = withAmount.reduce((acc, { amountUsd }) => acc + amountUsd, 0);

  const positions: SuppliedPosition[] = withAmount.map(({ row, amountUsd }) => ({
    id: row.id,
    name: row.name,
    tokenSymbol: row.tokenSymbol,
    kind: row.kind,
    address: row.address,
    amountUsd,
    rate: row.rate.value,
    color: resolveTokenColor(row.tokenSymbol),
    share: totalSupplied > 0 ? amountUsd / totalSupplied : 0,
    detailPath: row.detailPath,
    chainIds: chainsFor(row)
  }));

  const projected1Y = positions.reduce((acc, p) => acc + projectAnnualEarnings(p.amountUsd, p.rate), 0);

  return {
    positions,
    totalSupplied,
    projected1Y,
    avgRate: totalSupplied > 0 ? projected1Y / totalSupplied : 0,
    activePositions: positions.length,
    suppliedTokens: [...new Set(positions.map(p => p.tokenSymbol))],
    networksWithPositions: [...networkSet].sort((a, b) => a - b)
  };
}
