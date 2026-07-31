import { GeoConfig, ModuleId } from './types';
import { FALLBACK_CONFIG } from './constants';
import { IS_PRODUCTION_ENV } from '@/lib/constants';

const MODULE_IDS: ModuleId[] = [
  'savings',
  'rewards',
  'expert',
  'trade',
  'upgrade',
  'stake',
  'vaults',
  'fixed'
];

const VALID_GEO_VALUES: Record<string, string[]> = {
  geo_mode: ['full', 'restricted'],
  ...Object.fromEntries(MODULE_IDS.map(id => [`geo_module_${id}`, ['true', 'false']]))
};

/**
 * Forces the resolved country, so the "we couldn't verify your region" state
 * (`geo_country=XX`) and a verified restricted one (`geo_country=US`) are both
 * reachable locally — the presets alone can't produce them, since which of the
 * two you get depends on whether the geo lookup happened to succeed.
 */
const GEO_COUNTRY_PARAM = 'geo_country';
const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;

export const GEO_OVERRIDE_PARAMS: string[] = [...Object.keys(VALID_GEO_VALUES), GEO_COUNTRY_PARAM];

export function isValidGeoParam(key: string, value: string): boolean {
  if (key === GEO_COUNTRY_PARAM) return COUNTRY_CODE_PATTERN.test(value);
  return VALID_GEO_VALUES[key]?.includes(value) ?? false;
}

export function applyGeoOverrides(config: GeoConfig, search?: string): GeoConfig {
  if (IS_PRODUCTION_ENV) return config;

  const params = new URLSearchParams(search ?? window.location.search);

  const hasGeoParams = Array.from(params.keys()).some(k => GEO_OVERRIDE_PARAMS.includes(k));
  if (!hasGeoParams) return config;

  const result: GeoConfig = {
    ...config,
    modules: { ...config.modules }
  };

  // Apply geo_mode preset
  const geoMode = params.get('geo_mode');
  if (geoMode === 'full') {
    result.isRegionRestricted = false;
    for (const id of MODULE_IDS) {
      result.modules[id] = { enabled: true };
    }
  } else if (geoMode === 'restricted') {
    result.isRegionRestricted = true;
    for (const id of MODULE_IDS) {
      result.modules[id] = { ...FALLBACK_CONFIG.modules[id] };
    }
  }

  // Apply the country override on top of the preset
  const country = params.get(GEO_COUNTRY_PARAM);
  if (country && isValidGeoParam(GEO_COUNTRY_PARAM, country)) {
    result.countryCode = country.toUpperCase();
  }

  // Apply individual module overrides (highest priority)
  for (const id of MODULE_IDS) {
    const val = params.get(`geo_module_${id}`);
    if (val === 'true') {
      result.modules[id] = { enabled: true };
    } else if (val === 'false') {
      result.modules[id] = { enabled: false, restrictionReason: 'Geo override: manually disabled' };
    }
  }

  return result;
}
