/**
 * Route handlers for `${VITE_AUTH_URL}/ip/status` — the one endpoint behind
 * both the VPN/region check and the pre-transaction gate's US/VPN branch.
 *
 * In the default e2e build (VITE_SKIP_AUTH_CHECK=true) the app never requests
 * it. A spec that forces the checks back on (see mock-terms-gate.ts) must
 * mock it explicitly with `mockIpStatusHandler`; the suite-wide default is
 * `unmockedIpStatusHandler`, which fails loudly instead of serving a
 * fail-open origin — a forgotten mock must never silently switch the US
 * signature gate off (the app fails closed on an unavailable check).
 */
import { Route } from '@playwright/test';

export type IpStatusMockOptions = {
  countryCode?: string;
  isVpn?: boolean;
  delayMs?: number;
};

/** Serves a chosen origin; the default is a non-VPN, non-US, non-restricted user. */
export const mockIpStatusHandler =
  ({ countryCode = 'XX', isVpn = false, delayMs = 0 }: IpStatusMockOptions = {}) =>
  async (route: Route) => {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({
        country_code: countryCode,
        is_vpn: isVpn,
        is_restricted_region: false
      })
    });
  };

/** The fixture default: any request proves a spec forced the checks on without mocking this endpoint. */
export const unmockedIpStatusHandler = async (route: Route) => {
  await route.fulfill({
    status: 500,
    headers: { 'Access-Control-Allow-Origin': '*' },
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'ip/status is not mocked — register mockIpStatus (mock-terms-gate.ts) in this spec'
    })
  });
};
