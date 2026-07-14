/**
 * Intercept the geo-config fetch and return an unrestricted config. Without
 * this, tests depend on staging-api reachability from the test browser: when
 * the fetch fails the app falls back to a restrictive config (savings /
 * rewards / expert disabled), which silently changes effectiveIntent and with
 * it network-toast copy and quick-switch rendering.
 */
import { Route } from '@playwright/test';

export const mockGeoConfig = (route: Route) => {
  route.fulfill({
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    contentType: 'application/json',
    body: JSON.stringify({
      version: '1.0.0',
      countryCode: 'XX',
      generatedAt: '2026-01-01T00:00:00.000Z',
      cacheTtl: 300,
      isRegionRestricted: false,
      // Keep the banner flag as the fallback config sets it so existing
      // cookie-consent expectations in the suite are unchanged.
      isCookiesBannerRequired: true,
      modules: {
        savings: { enabled: true },
        rewards: { enabled: true },
        expert: { enabled: true },
        trade: { enabled: true },
        upgrade: { enabled: true },
        stake: { enabled: true },
        vaults: { enabled: true },
        fixed: { enabled: true }
      }
    })
  });
};
