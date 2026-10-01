import type { SuppliedPosition } from './suppliedView';

/** Legend row / donut segment id of the "Others" bucket. Position ids are
 * `${rowId}:${chainId}`, so this can never collide with one. */
export const OTHERS_ID = 'others';

/** Below this share of total supplied a position counts as small. */
export const SMALL_SHARE = 0.01;
/** Small positions fold into "Others" once there are at least this many positions. */
export const FOLD_SMALL_FROM = 4;
/** At most this many legend rows; past it the tail folds into the last one, "Others". */
export const MAX_ROWS = 5;

export type SuppliedLegend = {
  /** Positions that keep a legend row and donut segment of their own, largest first. */
  named: SuppliedPosition[];
  /** Positions folded into the trailing "Others" row (empty → no such row). */
  others: SuppliedPosition[];
};

/**
 * Folds the Supplied tab's long tail into an "Others" row (Figma 3356:51979 /
 * 3356:52120, thresholds per the user 2026-10-01):
 * - up to 3 positions, every position keeps its row, however small;
 * - from 4, positions under 1% of the total fold into "Others";
 * - from 5, the legend caps at 5 rows: the 4 largest plus "Others".
 * Expects `positions` sorted by amount descending (as `buildSuppliedView`
 * returns them), so the small ones and the folded tail are always a suffix.
 */
export function buildSuppliedLegend(positions: SuppliedPosition[]): SuppliedLegend {
  if (positions.length < FOLD_SMALL_FROM) return { named: positions, others: [] };
  const large = positions.filter(p => p.share >= SMALL_SHARE).length;
  const keep = positions.length >= MAX_ROWS ? Math.min(large, MAX_ROWS - 1) : large;
  return { named: positions.slice(0, keep), others: positions.slice(keep) };
}
