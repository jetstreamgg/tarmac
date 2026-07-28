import { redirect } from '@tanstack/react-router';
import { queryClient } from '@/lib/queryClient';
import { ROUTES } from '@/lib/routes';
import { applyGeoOverrides } from './applyGeoOverrides';
import { FALLBACK_CONFIG } from './constants';
import { GEO_BYPASS, geoConfigQueryOptions } from './query';
import { ModuleId } from './types';

/**
 * Route-level geo gate for the module destinations.
 *
 * Until G5 the shell swapped a geo-restricted module's panes for the Balances
 * pair inside the two-pane box. Full-width pages have no pane to swap, so the
 * gate moved to the router: a restricted module's URL redirects to /portfolio
 * instead of rendering. This also closes the hole that swap left open — it only
 * ever ran on the boxed branch, so once every route went full-width a direct
 * deep link to a restricted module rendered it in full.
 *
 * Shares the provider's query (same key, same client), so the config is fetched
 * once and the guard is a cache read on every navigation after the first. The
 * first navigation awaits it; `fetchGeoConfig` resolves to the restrictive
 * FALLBACK_CONFIG on error or after its own 5s timeout, so a failed lookup
 * redirects rather than hanging.
 */
export async function requireModuleEnabled(moduleId: ModuleId, searchStr: string, search: unknown) {
  if (GEO_BYPASS) return;

  let config;
  try {
    config = await queryClient.ensureQueryData(geoConfigQueryOptions);
  } catch {
    // ensureQueryData rejects only if every retry threw; fetchGeoConfig already
    // swallows its own failures, so this is belt-and-braces. Restrictive default.
    config = FALLBACK_CONFIG;
  }

  // Honor the ?geo_mode= / ?geo_module_<id>= dev overrides the provider applies,
  // so a guarded route and the UI it renders agree on the same effective config.
  const effective = applyGeoOverrides(config, searchStr);

  if (!effective.modules[moduleId]?.enabled) {
    throw redirect({ to: ROUTES.PORTFOLIO, search: search as Record<string, string>, replace: true });
  }
}
