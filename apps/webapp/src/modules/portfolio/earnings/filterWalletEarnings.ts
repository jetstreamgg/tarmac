import { combineWalletEarnings } from './combineWalletEarnings';
import type { WalletEarnings } from './types';

/**
 * Drops the earnings sources whose marketplace rows are geo-hidden.
 * Geo-restricted products disappear from every Portfolio surface (APP-484
 * treatment, see useGeoVisibleRows), so their earnings must not fold into the
 * visible totals either — a hidden product's figure would inflate "Total
 * accrued" with no row left to explain it (post-merge review finding #2).
 * Dropping a source removes it from the combined sums AND from the
 * missing-source lists: a hidden product is out of scope, not a data gap.
 *
 * Exclude semantics on purpose: the filter names the HIDDEN rows, not the
 * visible ones, so a source without a marketplace row of its own keeps its
 * earnings in "Total accrued".
 */
export function filterWalletEarnings(
  earnings: WalletEarnings,
  hiddenRowIds: ReadonlySet<string>
): WalletEarnings {
  if (hiddenRowIds.size === 0) return earnings;
  const protocols = earnings.protocols.filter(p => !p.rowIds.some(id => hiddenRowIds.has(id)));
  if (protocols.length === earnings.protocols.length) return earnings;
  return {
    protocols,
    combined: combineWalletEarnings(protocols),
    isLoading: protocols.some(p => p.isLoading),
    window: earnings.window
  };
}
