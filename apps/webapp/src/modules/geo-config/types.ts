export type ModuleId = 'savings' | 'rewards' | 'expert' | 'trade' | 'upgrade' | 'seal';

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
  isCookieBannerRequired: boolean;
}
