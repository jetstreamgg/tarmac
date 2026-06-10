import { SUPPORTED_TOKEN_SYMBOLS } from '@/widgets';
import { QueryParams, IS_PRODUCTION_ENV } from '@/lib/constants';
import { GEO_OVERRIDE_PARAMS, isValidGeoParam } from '@/modules/geo-config/applyGeoOverrides';
import { ConvertIntent, Intent } from '@/lib/enums';
import { defaultConfig } from '../config/default-config';

/**
 * Validates the search params that remain query-driven after the path
 * navigation migration (network, details, flow, tokens...). Navigation state
 * (module, submodule, entities) lives in the path and is validated by the
 * routes and useAppOrchestration's route-validation effect.
 */
export const validateSearchParams = (
  searchParams: URLSearchParams,
  intent: Intent,
  convertIntent: ConvertIntent | undefined,
  isL2Chain: boolean
) => {
  // Token params are validated against the module that consumes them: savings,
  // and the convert submodules (upgrade only outside L2 chains).
  const acceptsSourceToken =
    intent === Intent.SAVINGS_INTENT ||
    (intent === Intent.CONVERT_INTENT &&
      (convertIntent === ConvertIntent.TRADE_INTENT ||
        convertIntent === ConvertIntent.PSM_INTENT ||
        (convertIntent === ConvertIntent.UPGRADE_INTENT && !isL2Chain)));

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

    // removes details param if value is not true or false
    if (key === QueryParams.Details && !['true', 'false'].includes(value.toLowerCase())) {
      searchParams.delete(key);
    }

    // validate source token
    if (key === QueryParams.SourceToken) {
      if (!acceptsSourceToken) {
        searchParams.delete(key);
      } else if (intent === Intent.CONVERT_INTENT) {
        // if module is upgrade, only valid source token is MKR, DAI or USDS
        if (convertIntent === ConvertIntent.UPGRADE_INTENT) {
          if (!['mkr', 'dai', 'usds'].includes(value.toLowerCase())) {
            searchParams.delete(key);
          }
        }

        // if module is trade, check if token is supported
        if (convertIntent === ConvertIntent.TRADE_INTENT) {
          const tradeValidValues = Object.values(SUPPORTED_TOKEN_SYMBOLS).map(symbol => symbol.toLowerCase());
          if (!tradeValidValues.includes(value.toLowerCase())) {
            searchParams.delete(key);
          }
        }

        if (convertIntent === ConvertIntent.PSM_INTENT) {
          if (!['usdc', 'usds'].includes(value.toLowerCase())) {
            searchParams.delete(key);
          }
        }
      }
    }

    // validate target token
    if (key === QueryParams.TargetToken) {
      // target token is only valid on trade
      if (intent !== Intent.CONVERT_INTENT || convertIntent !== ConvertIntent.TRADE_INTENT) {
        searchParams.delete(key);
      }

      // check if token is supported
      const tradeValidValues = Object.values(SUPPORTED_TOKEN_SYMBOLS).map(symbol => symbol.toLowerCase());
      if (!tradeValidValues.includes(value.toLowerCase())) {
        searchParams.delete(key);
      }

      // check if target token is valid based off source token
      const sourceToken = searchParams.get(QueryParams.SourceToken);
      if (sourceToken) {
        const disallowedPairs = defaultConfig.tradeDisallowedPairs;
        const pairsToCheck = disallowedPairs?.[sourceToken.toUpperCase()];
        if (pairsToCheck?.includes(value.toUpperCase() as SUPPORTED_TOKEN_SYMBOLS)) {
          searchParams.delete(key);
        }
      }
    }
  });

  return searchParams;
};
