import type { EarnProductKind } from '@/hooks';
import { earningsForPosition } from './earningsForPosition';
import { isAnnouncedGap, type WalletEarnings } from './types';

/** The product identity a breakdown row needs (satisfied by EarnProductRow). */
export type BreakdownProduct = { id: string; name: string; tokenSymbol: string; kind: EarnProductKind };

export type BreakdownRow = {
  product: BreakdownProduct;
  /** undefined = no figure (the source failed or doesn't cover this window). */
  usd?: number;
  isLoading: boolean;
  /** A held product with no earnings source: shown at $0.00 with a "Not tracked" badge. */
  untracked?: boolean;
};

/**
 * One row per product for the Total / This month popup (APP-589): every held
 * product — tracked or not — plus exited products that still carry earnings
 * or a failed source (the combined figure excludes those, so the popup must
 * name them). Products with a figure sort by value, largest first; rows
 * without one (loading, unavailable, not tracked) follow.
 */
export function buildEarningsBreakdown({
  earnings,
  field,
  products,
  heldRowIds
}: {
  earnings: WalletEarnings;
  field: 'total' | 'month';
  products: BreakdownProduct[];
  heldRowIds: ReadonlySet<string>;
}): BreakdownRow[] {
  const productById = new Map(products.map(p => [p.id, p]));
  const trackedIds = new Set(earnings.protocols.flatMap(p => p.rowIds));
  const rowIds = [...new Set([...heldRowIds, ...trackedIds])];

  const rows: BreakdownRow[] = [];
  for (const rowId of rowIds) {
    const product = productById.get(rowId);
    if (!product) continue;
    const held = heldRowIds.has(rowId);

    const slice = earningsForPosition(earnings, rowId);
    if (!slice) {
      if (held) rows.push({ product, usd: 0, isLoading: false, untracked: true });
      continue;
    }

    const figure = field === 'total' ? slice.totalEarned : slice.earnedThisMonth;
    if (figure.status === 'notAvailable') {
      if (figure.reason === 'loading') {
        if (held) rows.push({ product, isLoading: true });
      } else if (held || !isAnnouncedGap(figure.reason)) {
        rows.push({ product, isLoading: false });
      }
      continue;
    }

    // Exited products with nothing earned are noise; held ones always show.
    if (!held && figure.value.usd === 0) continue;
    rows.push({ product, usd: figure.value.usd, isLoading: false });
  }

  const rank = (row: BreakdownRow) => (row.untracked ? 3 : row.isLoading ? 1 : row.usd === undefined ? 2 : 0);
  return rows.sort((a, b) => rank(a) - rank(b) || (b.usd ?? 0) - (a.usd ?? 0));
}
