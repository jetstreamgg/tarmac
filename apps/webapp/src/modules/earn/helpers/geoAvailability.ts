import type { EarnProductRow } from '@/hooks';
// Straight from the leaf modules, not the barrel: that re-exports the provider,
// which pulls the router into anything importing this helper.
import { geoModuleForIntent } from '@/modules/geo-config/moduleForIntent';
import type { ModuleId } from '@/modules/geo-config/types';

/**
 * Splits the marketplace rows into the two sections of the geo-restricted Earn
 * page (1036:201400, APP-432 item 8): everything the region allows, and the
 * "Products unavailable in the US" remainder. A product whose intent maps to no
 * geo module is never restricted.
 *
 * Order within each list is preserved, so the caller's filter/sort pass sees
 * the registry order it already relies on.
 */
export function partitionByGeoAvailability(
  rows: EarnProductRow[],
  isModuleEnabled: (moduleId: ModuleId) => boolean
): { availableRows: EarnProductRow[]; unavailableRows: EarnProductRow[] } {
  const availableRows: EarnProductRow[] = [];
  const unavailableRows: EarnProductRow[] = [];

  for (const row of rows) {
    const moduleId = geoModuleForIntent(row.intent);
    (!moduleId || isModuleEnabled(moduleId) ? availableRows : unavailableRows).push(row);
  }

  return { availableRows, unavailableRows };
}
