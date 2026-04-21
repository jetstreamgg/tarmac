import { ReactElement, ReactNode, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoConfigContext } from './GeoConfigContext';
import { GeoConfig, GeoConfigContextValue, ModuleId } from '../types';
import { FALLBACK_CONFIG } from '../constants';
import { applyGeoOverrides } from '../applyGeoOverrides';
import { router } from '@/pages/router';

// When true, bypass geo-restrictions entirely (for local development)
const GEO_BYPASS = import.meta.env.VITE_GEO_BYPASS === 'true';

// Endpoint URL - use staging for now, will be configured via env var
const GEO_CONFIG_URL = import.meta.env.VITE_GEO_CONFIG_URL || 'https://staging-api.sky.money/geo-config';

async function fetchGeoConfig(): Promise<GeoConfig> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(GEO_CONFIG_URL, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error('Geo config fetch failed:', res.status);
      return FALLBACK_CONFIG;
    }
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Geo config fetch error:', error);
    return FALLBACK_CONFIG;
  }
}

function getGeoOverrideSearch(): string {
  return router.state.location.search || (typeof window !== 'undefined' ? window.location.search : '');
}

export const GeoConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const {
    data: config,
    isLoading,
    error
  } = useQuery<GeoConfig>({
    queryKey: ['geo-config'],
    queryFn: fetchGeoConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000)
  });

  const locationSearch = useSyncExternalStore(
    onStoreChange => router.subscribe(() => onStoreChange()),
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
      isRegionRestricted: GEO_BYPASS ? false : isLoading ? true : (effectiveConfig?.isRegionRestricted ?? true),
      isCookieBannerRequired: isLoading ? true : (effectiveConfig?.isCookiesBannerRequired ?? true)
    }),
    [effectiveConfig, isLoading, error, isModuleEnabled, getModuleRestrictionReason]
  );

  return <GeoConfigContext.Provider value={value}>{children}</GeoConfigContext.Provider>;
};
