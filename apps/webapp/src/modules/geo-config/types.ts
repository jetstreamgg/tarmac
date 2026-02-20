export type ModuleId = 'savings' | 'rewards' | 'expert' | 'trade' | 'upgrade' | 'seal';

export interface ModuleConfig {
  enabled: boolean;
  restrictionReason?: string;
}

export interface GeoConfig {
  version: string;
  countryCode: string;
  timestamp: string;
  cacheTtl: number;
  modules: Record<ModuleId, ModuleConfig>;
  chatbot: {
    enabled: boolean;
    restrictionMessage?: string;
  };
}

export interface GeoConfigContextValue {
  config: GeoConfig | undefined;
  isLoading: boolean;
  error: Error | null;
  isModuleEnabled: (moduleId: ModuleId) => boolean;
  getModuleRestrictionReason: (moduleId: ModuleId) => string | undefined;
  isChatbotEnabled: boolean;
  chatbotRestrictionMessage: string | undefined;
}
