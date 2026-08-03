export type ModuleId = 'savings' | 'rewards' | 'expert' | 'trade' | 'upgrade' | 'stake' | 'vaults' | 'fixed';

export interface ModuleConfig {
  enabled: boolean;
  restrictionReason?: string;
}

export interface GeoConfig {
  version: string;
  countryCode: string;
  generatedAt: string;
  cacheTtl: number;
  isRegionRestricted: boolean;
  modules: Record<ModuleId, ModuleConfig>;
  isCookiesBannerRequired: boolean;
}

export interface GeoConfigContextValue {
  config: GeoConfig | undefined;
  isLoading: boolean;
  error: Error | null;
  isModuleEnabled: (moduleId: ModuleId) => boolean;
  getModuleRestrictionReason: (moduleId: ModuleId) => string | undefined;
  isRegionRestricted: boolean;
  /**
   * False when the region lookup never resolved a country — the request failed
   * and we're on FALLBACK_CONFIG, which restricts modules defensively. Surfaces
   * that distinction to the UI so it doesn't claim a region it doesn't know.
   */
  isRegionVerified: boolean;
  isCookieBannerRequired: boolean;
}
