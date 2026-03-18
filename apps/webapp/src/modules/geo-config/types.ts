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
  chatbot: {
    enabled: boolean;
    restrictionMessage?: string;
  };
  cookieBannerEnabled: boolean;
}

export interface GeoConfigContextValue {
  config: GeoConfig | undefined;
  isLoading: boolean;
  error: Error | null;
  isModuleEnabled: (moduleId: ModuleId) => boolean;
  getModuleRestrictionReason: (moduleId: ModuleId) => string | undefined;
  isRegionRestricted: boolean;
  isChatbotEnabled: boolean;
  chatbotRestrictionMessage: string | undefined;
  isCookieBannerRequired: boolean;
}
