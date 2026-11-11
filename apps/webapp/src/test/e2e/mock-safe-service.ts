/**
 * Default Safe Transaction Service for every spec: no address is a Safe. The
 * wallet type check and the bridge form ask the service, and the real one is
 * rate-limited and sometimes down, which left Review disabled behind "We
 * couldn't check your wallet type". `enableSafeMode` registers its own handler
 * later, which takes precedence. Any other path is recorded so the fixture can
 * fail the test instead of quietly answering something the app didn't expect.
 */
import { type Route } from '@playwright/test';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';

const ORIGINS = new Set(Object.values(SAFE_TRANSACTION_SERVICE_URL));

export const isSafeServiceUrl = (url: URL) => ORIGINS.has(url.origin);

export const noSafeServiceHandler = (unmocked: string[]) => (route: Route) => {
  const request = route.request();
  const headers = { 'Access-Control-Allow-Origin': '*' };
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  const { pathname } = new URL(request.url());
  if (request.method() !== 'GET' || !/^\/api\/v1\/safes\/0x[0-9a-fA-F]{40}\/?$/.test(pathname)) {
    unmocked.push(`${request.method()} ${pathname}`);
  }
  return route.fulfill({
    status: 404,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'Not found.' })
  });
};
