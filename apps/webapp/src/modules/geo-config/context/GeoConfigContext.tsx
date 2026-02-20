import { createContext } from 'react';
import { GeoConfigContextValue, ModuleId } from '../types';

// Restrictive defaults - block potentially restricted features until config loads
export const defaultGeoConfigContext: GeoConfigContextValue = {
  config: undefined,
  isLoading: true,
  error: null,
  isModuleEnabled: () => false,
  getModuleRestrictionReason: () => 'Loading...',
  isChatbotEnabled: false,
  chatbotRestrictionMessage: undefined
};

export const GeoConfigContext = createContext<GeoConfigContextValue>(defaultGeoConfigContext);
