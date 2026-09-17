import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  trackErrorBoundaryTriggered,
  trackNotFoundViewed,
  trackPromoClicked,
  trackPromoImpression,
  trackRouteErrorViewed
} from './trackAmbientSurfaces';
import { capturedEventsNamed, clearCapturedEvents } from '@/test/analyticsCapture';

vi.mock('../PostHogProvider', () => ({ POSTHOG_ENABLED: true }));

describe('trackAmbientSurfaces', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Past the dedupe window of whatever the previous test emitted.
    vi.setSystemTime(vi.getRealSystemTime());
    vi.advanceTimersByTime(1000);
    clearCapturedEvents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures promo impressions and clicks with the promo id', () => {
    trackPromoImpression({ promoId: 'allocate_stablecoins' });
    trackPromoClicked({ promoId: 'allocate_stablecoins' });

    expect(capturedEventsNamed('app_promo_impression')[0].properties).toMatchObject({
      promo_id: 'allocate_stablecoins',
      viewport: expect.any(String)
    });
    expect(capturedEventsNamed('app_promo_clicked')).toHaveLength(1);
  });

  it('captures error surfaces with their path', () => {
    trackRouteErrorViewed({ path: '/earn' });
    trackNotFoundViewed({ path: '/bogus' });
    trackErrorBoundaryTriggered({ boundaryName: 'SavingsCard' });

    expect(capturedEventsNamed('app_route_error_viewed')[0].properties).toMatchObject({ path: '/earn' });
    expect(capturedEventsNamed('app_not_found_viewed')[0].properties).toMatchObject({ path: '/bogus' });
    expect(capturedEventsNamed('app_error_boundary_triggered')[0].properties).toMatchObject({
      boundary_name: 'SavingsCard',
      path: expect.any(String)
    });
  });

  it('dedupes identical emissions inside the window (StrictMode double-run)', () => {
    trackPromoImpression({ promoId: 'savings_tvl_simulate' });
    vi.advanceTimersByTime(50);
    trackPromoImpression({ promoId: 'savings_tvl_simulate' });

    expect(capturedEventsNamed('app_promo_impression')).toHaveLength(1);
  });

  it('keeps interleaved distinct surfaces intact while deduping each (per-key window)', () => {
    // StrictMode re-runs effects per component after ALL first runs: A B A B.
    trackPromoImpression({ promoId: 'connect_wallet_card' });
    trackNotFoundViewed({ path: '/x' });
    vi.advanceTimersByTime(20);
    trackPromoImpression({ promoId: 'connect_wallet_card' });
    trackNotFoundViewed({ path: '/x' });

    expect(capturedEventsNamed('app_promo_impression')).toHaveLength(1);
    expect(capturedEventsNamed('app_not_found_viewed')).toHaveLength(1);
  });

  it('emits again outside the dedupe window', () => {
    // The per-key map survives across tests and beforeEach resets the clock to
    // the same real-time base — move well past any earlier test's emission.
    vi.advanceTimersByTime(2000);
    trackPromoImpression({ promoId: 'connect_wallet_card' });
    vi.advanceTimersByTime(600);
    trackPromoImpression({ promoId: 'connect_wallet_card' });

    expect(capturedEventsNamed('app_promo_impression')).toHaveLength(2);
  });
});
