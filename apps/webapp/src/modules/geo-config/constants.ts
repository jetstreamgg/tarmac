import { GeoConfig } from './types';

// Restrictive fallback config - used when the API fails and as the base for geo_mode=restricted
export const FALLBACK_CONFIG: GeoConfig = {
  version: '0.0.0',
  countryCode: 'XX',
  generatedAt: new Date().toISOString(),
  cacheTtl: 60,
  isRegionRestricted: true,
  modules: {
    savings: { enabled: false, restrictionReason: 'Unable to verify region' },
    rewards: { enabled: false, restrictionReason: 'Unable to verify region' },
    expert: { enabled: false, restrictionReason: 'Unable to verify region' },
    trade: { enabled: true }, // Trade is not restricted
    upgrade: { enabled: true },
    seal: { enabled: true }
  },
  chatbot: { enabled: false, restrictionMessage: 'Unable to verify region' },
  isCookiesBannerRequired: true
};
