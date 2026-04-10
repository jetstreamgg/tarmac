import { GeoConfig, ModuleId } from './types';
import { FALLBACK_CONFIG } from './constants';
import { IS_PRODUCTION_ENV } from '@/lib/constants';

const MODULE_IDS: ModuleId[] = ['savings', 'rewards', 'expert', 'trade', 'upgrade', 'seal'];

const VALID_GEO_VALUES: Record<string, string[]> = {
  geo_mode: ['full', 'restricted'],
  ...Object.fromEntries(MODULE_IDS.map(id => [`geo_module_${id}`, ['true', 'false']]))
};

export const GEO_OVERRIDE_PARAMS: string[] = Object.keys(VALID_GEO_VALUES);

export function isValidGeoParam(key: string, value: string): boolean {
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
