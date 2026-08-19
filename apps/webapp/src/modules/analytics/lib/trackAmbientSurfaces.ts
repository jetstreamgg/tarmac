import posthog from 'posthog-js';
import { POSTHOG_ENABLED } from '../PostHogProvider';
import { AppEvents, getViewport, safeCapture, type PromoId } from '../constants';

const lastEmissionAt = new Map<string, number>();

/**
 * Module-level capture for ambient (non-funnel, no flow_id) surfaces: error
 * pages, error boundaries and promo banners. No hooks, so class components and
 * presentational components stay provider-free; the identical-event window
 * absorbs StrictMode double-run effects. Keyed per event+props (not a single
 * slot like trackRouteRedirected) because these surfaces can mount interleaved
 * in one commit.
 */
function captureAmbient(event: string, properties: Record<string, unknown>): void {
  if (!POSTHOG_ENABLED) return;
  const key = `${event}:${JSON.stringify(properties)}`;
  const now = Date.now();
  const last = lastEmissionAt.get(key);
  if (last !== undefined && now - last < 500) return;
  lastEmissionAt.set(key, now);
  safeCapture(posthog, event, { ...properties, viewport: getViewport() });
}

export function trackErrorBoundaryTriggered({ boundaryName }: { boundaryName: string }): void {
  captureAmbient(AppEvents.ERROR_BOUNDARY_TRIGGERED, {
    boundary_name: boundaryName,
    path: typeof window === 'undefined' ? '' : window.location.pathname
  });
}

export function trackRouteErrorViewed({ path }: { path: string }): void {
  captureAmbient(AppEvents.ROUTE_ERROR_VIEWED, { path });
}

export function trackNotFoundViewed({ path }: { path: string }): void {
  captureAmbient(AppEvents.NOT_FOUND_VIEWED, { path });
}

export function trackPromoImpression({ promoId }: { promoId: PromoId }): void {
  captureAmbient(AppEvents.PROMO_IMPRESSION, { promo_id: promoId });
}

export function trackPromoClicked({ promoId }: { promoId: PromoId }): void {
  captureAmbient(AppEvents.PROMO_CLICKED, { promo_id: promoId });
}
