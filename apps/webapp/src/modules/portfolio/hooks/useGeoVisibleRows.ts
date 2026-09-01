import { useMemo } from 'react';
import type { EarnProductRow } from '@/hooks';
import { useGeoConfig } from '@/modules/geo-config';
import { partitionByGeoAvailability } from '@/modules/earn/helpers/geoAvailability';

/**
 * Marketplace rows minus geo-restricted modules. The Portfolio hides restricted
 * products outright — the production precedent (APP-155's BalancesWidget
 * treatment), unlike /earn's "Products unavailable in the US" section (APP-484).
 *
 * Every row passes while the config loads: the loading default is restrictive
 * and would blank all gated products for everyone — same tradeoff EarnPage
 * takes, at the cost of a brief flash for actually-restricted visitors.
 */
export function useGeoVisibleRows(rows: EarnProductRow[]): EarnProductRow[] {
  const { isModuleEnabled, isLoading } = useGeoConfig();
  return useMemo(
    () => (isLoading ? rows : partitionByGeoAvailability(rows, isModuleEnabled).availableRows),
    [rows, isLoading, isModuleEnabled]
  );
}
