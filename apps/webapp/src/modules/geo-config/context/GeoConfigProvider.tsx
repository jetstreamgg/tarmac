import { ReactElement, ReactNode, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoConfigContext } from './GeoConfigContext';
import { GeoConfig, GeoConfigContextValue, ModuleId } from '../types';
import { applyGeoOverrides } from '../applyGeoOverrides';
import { UNKNOWN_COUNTRY_CODE } from '../constants';
import { GEO_BYPASS, geoConfigQueryOptions } from '../query';
import { router } from '@/pages/router';

function getGeoOverrideSearch(): string {
  return router.history.location.search || (typeof window !== 'undefined' ? window.location.search : '');
}

export const GeoConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const {
    data: config,
    isLoading,
    error
  } = useQuery<GeoConfig>({
    ...geoConfigQueryOptions,
    enabled: !GEO_BYPASS
  });

  const locationSearch = useSyncExternalStore(
    onStoreChange => router.history.subscribe(() => onStoreChange()),
    getGeoOverrideSearch,
    getGeoOverrideSearch
  );

  const effectiveConfig = useMemo(
    () => (config ? applyGeoOverrides(config, locationSearch) : undefined),
    [config, locationSearch]
  );

  const isModuleEnabled = useCallback(
    (moduleId: ModuleId): boolean => {
      if (isLoading) return false; // Restrictive while loading
      return effectiveConfig?.modules[moduleId]?.enabled ?? false;
    },
    [effectiveConfig, isLoading]
  );

  const getModuleRestrictionReason = useCallback(
    (moduleId: ModuleId): string | undefined => {
      if (isLoading) return 'Loading...';
      return effectiveConfig?.modules[moduleId]?.restrictionReason;
    },
    [effectiveConfig, isLoading]
  );

  const value: GeoConfigContextValue = useMemo(
    () => ({
      config: effectiveConfig,
      isLoading,
      error: error as Error | null,
      isModuleEnabled: GEO_BYPASS ? () => true : isModuleEnabled,
      getModuleRestrictionReason: GEO_BYPASS ? () => undefined : getModuleRestrictionReason,
      isRegionRestricted: GEO_BYPASS
        ? false
        : isLoading
          ? true
          : (effectiveConfig?.isRegionRestricted ?? true),
      // Bypassed deployments answer for the region themselves; otherwise a
      // missing or placeholder country code means the lookup never landed.
      isRegionVerified: GEO_BYPASS
        ? true
        : !isLoading &&
          !!effectiveConfig?.countryCode &&
          effectiveConfig.countryCode !== UNKNOWN_COUNTRY_CODE,
      isCookieBannerRequired: isLoading ? true : (effectiveConfig?.isCookiesBannerRequired ?? true)
    }),
    [effectiveConfig, isLoading, error, isModuleEnabled, getModuleRestrictionReason]
  );

  return <GeoConfigContext.Provider value={value}>{children}</GeoConfigContext.Provider>;
};
