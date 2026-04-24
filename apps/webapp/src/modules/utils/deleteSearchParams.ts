import { IS_PRODUCTION_ENV, QueryParams } from '@/lib/constants';
import { GEO_OVERRIDE_PARAMS } from '@/modules/geo-config/applyGeoOverrides';

export const deleteSearchParams = (searchParams: URLSearchParams): URLSearchParams => {
  const keysToDelete: string[] = [];

  searchParams.forEach((_, key) => {
    // Collect keys to delete after iteration to avoid potential issues during modification
    if (
      QueryParams.Details !== key &&
      QueryParams.Widget !== key &&
      QueryParams.Network !== key &&
      !(!IS_PRODUCTION_ENV && GEO_OVERRIDE_PARAMS.includes(key))
    ) {
      keysToDelete.push(key);
    }
  });

  // Delete collected keys
  keysToDelete.forEach(key => {
    searchParams.delete(key);
  });

  return searchParams;
};
