import { QueryParams, IS_PRODUCTION_ENV } from '@/lib/constants';
import { GEO_OVERRIDE_PARAMS, isValidGeoParam } from '@/modules/geo-config/applyGeoOverrides';
import { Intent } from '@/lib/enums';

// The modules that read `source_token`, with their accepted values: Savings'
// origin selector and Convert's PSM direction (E2 — USDC↔USDS only).
const CONVERT_SOURCE_TOKENS = ['usdc', 'usds'];

/**
 * Validates the search params that remain query-driven after the path
 * navigation migration (network, flow, tokens...). Navigation state
 * (module, submodule, entities) lives in the path and is validated by the
 * routes and useAppOrchestration's route-validation effect.
 */
export const validateSearchParams = (searchParams: URLSearchParams, intent: Intent) => {
  // Iterate over a snapshot: deleting from URLSearchParams while forEach-ing
  // skips the entry that shifts into the deleted slot.
  [...searchParams.entries()].forEach(([key, value]) => {
    // removes any query param not found in QueryParams (preserve valid geo override params in non-production)
    if (!Object.values(QueryParams).includes(key as QueryParams)) {
      if (!IS_PRODUCTION_ENV && GEO_OVERRIDE_PARAMS.includes(key)) {
        if (!isValidGeoParam(key, value)) {
          searchParams.delete(key);
        }
      } else {
        searchParams.delete(key);
      }
    }

    // validate source token: Savings validates its own origin values; Convert
    // (the PSM page) accepts only its two conversion tokens.
    if (key === QueryParams.SourceToken) {
      if (intent === Intent.CONVERT_INTENT) {
        if (!CONVERT_SOURCE_TOKENS.includes(value.toLowerCase())) {
          searchParams.delete(key);
        }
      } else if (intent !== Intent.SAVINGS_INTENT) {
        searchParams.delete(key);
      }
    }

    // target token belonged to the legacy trade surface (parked pending E3).
    if (key === QueryParams.TargetToken) {
      searchParams.delete(key);
    }
  });

  return searchParams;
};
