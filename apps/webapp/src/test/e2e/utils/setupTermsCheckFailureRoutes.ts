import type { Page } from '@playwright/test';

/**
 * Mocks VPN + address allowlist (required when VITE_SKIP_AUTH_CHECK=false) and forces the
 * terms-acceptance /check request to fail so the Legal Terms modal shows the error state.
 */
export async function setupTermsCheckFailureRoutes(page: Page): Promise<void> {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());

    if (url.pathname.includes('terms-acceptance') && url.pathname.endsWith('/check')) {
      await route.abort('failed');
      return;
    }

    if (url.pathname === '/ip/status' || url.pathname.endsWith('/ip/status')) {
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          country_code: 'US',
          is_vpn: false,
          is_restricted_region: false
        })
      });
      return;
    }

    if (url.pathname.includes('/address/status')) {
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ addressAllowed: true })
      });
      return;
    }

    await route.continue();
  });
}
