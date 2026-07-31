import type { UseQueryOptions } from '@tanstack/react-query';
import { GeoConfig } from './types';
import { FALLBACK_CONFIG } from './constants';
import { isPrivateDeployment } from '@/lib/isPrivateDeployment';
import { reportError } from '@/modules/sentry/reportError';

/**
 * Fetch + query options for the geo config, in a leaf module so both the React
 * provider and the router's `beforeLoad` guard share one query (and therefore
 * one network request and one cache entry). Deliberately imports no router and
 * no provider tree — route modules pull this in.
 */

// When true, bypass geo-restrictions entirely (for local development or
// Cloudflare Access-gated private deployments like app-private.sky.money)
export const GEO_BYPASS = import.meta.env.VITE_GEO_BYPASS === 'true' || isPrivateDeployment();

// Endpoint URL - use staging for now, will be configured via env var
const GEO_CONFIG_URL = import.meta.env.VITE_GEO_CONFIG_URL || 'https://staging-api.sky.money/geo-config';

export const GEO_CONFIG_QUERY_KEY = ['geo-config'] as const;

export async function fetchGeoConfig(): Promise<GeoConfig> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(GEO_CONFIG_URL, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      reportError(new Error(`Geo config fetch failed with status ${res.status}`), {
        module: 'geo-config',
        flow: 'fetch-config',
        action: 'fetch',
        type: 'http_error',
        statusCode: res.status
      });
      return FALLBACK_CONFIG;
    }
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    // AbortError (DOMException code 20) is expected and already handled: either the
    // 5s timeout above fired on a slow/filtered network, or the user navigated away
    // mid-flight. We fall back to FALLBACK_CONFIG either way, so it's non-actionable
    // noise — don't report it (WEBAPP-5M). Genuine failures still surface: non-ok
    // responses are reported as `http_error` in the branch above.
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    if (!isAbortError) {
      reportError(error, {
        module: 'geo-config',
        flow: 'fetch-config',
        action: 'fetch',
        type: 'request_error'
      });
    }
    return FALLBACK_CONFIG;
  }
}

export const geoConfigQueryOptions = {
  queryKey: GEO_CONFIG_QUERY_KEY,
  queryFn: fetchGeoConfig,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000)
} satisfies UseQueryOptions<GeoConfig>;
