import { GeoConfig } from './types';

// ISO 3166 "unknown country" placeholder: the lookup never resolved a region, so
// callers can tell "restricted because you're in the US" from "restricted because
// we couldn't tell where you are".
export const UNKNOWN_COUNTRY_CODE = 'XX';

// Restrictive fallback config - used when the API fails and as the base for geo_mode=restricted
export const FALLBACK_CONFIG: GeoConfig = {
  version: '0.0.0',
  countryCode: UNKNOWN_COUNTRY_CODE,
  generatedAt: new Date().toISOString(),
  cacheTtl: 60,
  isRegionRestricted: true,
  modules: {
    savings: { enabled: false, restrictionReason: 'Unable to verify region' },
    rewards: { enabled: false, restrictionReason: 'Unable to verify region' },
    expert: { enabled: false, restrictionReason: 'Unable to verify region' },
    trade: { enabled: true }, // Trade is not restricted
    upgrade: { enabled: true },
    stake: { enabled: true },
    vaults: { enabled: true },
    fixed: { enabled: true }
  },
  isCookiesBannerRequired: true
};
