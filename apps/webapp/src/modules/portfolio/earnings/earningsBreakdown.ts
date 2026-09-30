import type { EarnProductKind } from '@/hooks';
import { earningsForPosition } from './earningsForPosition';
import { isAnnouncedGap, type WalletEarnings } from './types';

/** The product identity a breakdown row needs (satisfied by EarnProductRow). */
export type BreakdownProduct = { id: string; name: string; tokenSymbol: string; kind: EarnProductKind };

/**
 * The one caveat a row can carry, rendered as its badge:
 * - 'not-tracked' — a held product with no earnings source (shown at $0.00;
 *   the badge says the zero isn't measured).
 * - 'unavailable' — the source failed; no figure.
 * - 'partial' — a figure missing a contributor that failed.
 * - 'rewards-not-included' — rewards aren't in this figure (non-Flagship vault
 *   Merkl attribution, or Merkl's missing monthly breakdown).
 * - 'mainnet-only' — the figure covers Ethereum Mainnet only.
 */
export type BreakdownNote =
  'not-tracked' | 'unavailable' | 'partial' | 'rewards-not-included' | 'mainnet-only';

export type BreakdownRow = {
  product: BreakdownProduct;
  /** undefined = no figure (unavailable). */
  usd?: number;
  isLoading: boolean;
  note?: BreakdownNote;
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
      if (held) rows.push({ product, usd: 0, isLoading: false, note: 'not-tracked' });
      continue;
    }

    const figure = field === 'total' ? slice.totalEarned : slice.earnedThisMonth;
    const missing = field === 'total' ? slice.missingFromTotal : slice.missingFromMonth;

    if (figure.status === 'notAvailable') {
      if (figure.reason === 'loading') {
        if (held) rows.push({ product, isLoading: true });
      } else if (!isAnnouncedGap(figure.reason)) {
        rows.push({ product, isLoading: false, note: 'unavailable' });
      } else if (held && figure.reason === 'merkl-monthly-unsupported') {
        rows.push({ product, isLoading: false, note: 'rewards-not-included' });
      }
      continue;
    }

    const usd = figure.value.usd;
    // Exited products with nothing earned are noise; held ones always show.
    if (!held && usd === 0) continue;

    const note: BreakdownNote | undefined = missing.some(m => !isAnnouncedGap(m.reason))
      ? 'partial'
      : slice.coverage === 'rewards-not-included' ||
          missing.some(m => m.reason === 'merkl-monthly-unsupported')
        ? 'rewards-not-included'
        : slice.coverage === 'mainnet-only'
          ? 'mainnet-only'
          : undefined;
    rows.push({ product, usd, isLoading: false, ...(note ? { note } : {}) });
  }

  const rank = (row: BreakdownRow) =>
    row.usd !== undefined && row.note !== 'not-tracked'
      ? 0
      : row.isLoading
        ? 1
        : row.usd === undefined
          ? 2
          : 3;
  return rows.sort((a, b) => rank(a) - rank(b) || (b.usd ?? 0) - (a.usd ?? 0));
}
