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
  isCookieBannerRequired: true
};

export const GeoConfigContext = createContext<GeoConfigContextValue>(defaultGeoConfigContext);
