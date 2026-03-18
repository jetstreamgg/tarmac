import { createContext } from 'react';
import { GeoConfigContextValue } from '../types';

// Restrictive defaults - block potentially restricted features until config loads
export const defaultGeoConfigContext: GeoConfigContextValue = {
  config: undefined,
  isLoading: true,
  error: null,
  isModuleEnabled: () => false,
  getModuleRestrictionReason: () => 'Loading...',
  isRegionRestricted: true,
  isChatbotEnabled: false,
  chatbotRestrictionMessage: undefined,
  isCookieBannerRequired: false
};

export const GeoConfigContext = createContext<GeoConfigContextValue>(defaultGeoConfigContext);
