import { ReactElement, ReactNode, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoConfigContext } from './GeoConfigContext';
import { GeoConfig, GeoConfigContextValue, ModuleId } from '../types';

// Endpoint URL - use staging for now, will be configured via env var
const GEO_CONFIG_URL =
  import.meta.env.VITE_GEO_CONFIG_URL ||
  'https://api-workers-staging.jetstream-account.workers.dev/geo-config';

// Restrictive fallback config - block everything that might be restricted
const FALLBACK_CONFIG: GeoConfig = {
  version: '0.0.0',
  countryCode: 'XX',
  timestamp: new Date().toISOString(),
  cacheTtl: 60,
  modules: {
    savings: { enabled: false, restrictionReason: 'Unable to verify region' },
    rewards: { enabled: false, restrictionReason: 'Unable to verify region' },
    expert: { enabled: false, restrictionReason: 'Unable to verify region' },
    trade: { enabled: true }, // Trade is not restricted
    upgrade: { enabled: true },
    seal: { enabled: true }
  },
  chatbot: { enabled: false, restrictionMessage: 'Unable to verify region' }
};

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

  const isModuleEnabled = useCallback(
    (moduleId: ModuleId): boolean => {
      if (isLoading) return false; // Restrictive while loading
      return config?.modules[moduleId]?.enabled ?? false;
    },
    [config, isLoading]
  );

  const getModuleRestrictionReason = useCallback(
    (moduleId: ModuleId): string | undefined => {
      if (isLoading) return 'Loading...';
      return config?.modules[moduleId]?.restrictionReason;
    },
    [config, isLoading]
  );

  const value: GeoConfigContextValue = useMemo(
    () => ({
      config,
      isLoading,
      error: error as Error | null,
      isModuleEnabled,
      getModuleRestrictionReason,
      isChatbotEnabled: config?.chatbot.enabled ?? false,
      chatbotRestrictionMessage: config?.chatbot.restrictionMessage
    }),
    [config, isLoading, error, isModuleEnabled, getModuleRestrictionReason]
  );

  return <GeoConfigContext.Provider value={value}>{children}</GeoConfigContext.Provider>;
};
