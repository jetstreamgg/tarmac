/**
 * Route mocks for the pre-transaction terms-signature gate (APP-501/APP-502).
 *
 * The e2e server runs with VITE_SKIP_AUTH_CHECK=true, which compiles the
 * whole compliance surface into a bypass — so a spec that wants to exercise
 * it first re-enables the checks per-page (`forceAuthChecks`), then supplies
 * every network dependency the surface has: /ip/status, /address/status and
 * /terms-acceptance/check. The mock wallet skips the /add and /sign POSTs
 * (their contracts are unit-covered), so those routes need no mocks here.
 *
 * The wallet signature itself goes over JSON-RPC: the wagmi mock connector
 * delegates `personal_sign` to the transport, and the Tenderly fork rejects
 * it — `mockPersonalSign` intercepts that call at the RPC boundary, which is
 * also how a spec drives the rejection path deterministically.
 */
import { type Page } from '@playwright/test';

const RPC_URL = 'https://virtual.**.rpc.tenderly.co/**';

/** The exact text a mocked /check hands to the gate to sign. */
export const MOCK_MESSAGE_TO_SIGN =
  'By signing this message I confirm that I have read and agree to the sky.money Terms of Use and Privacy Policy.';

/**
 * Re-enables the auth/terms checks the e2e build skips. Must run before the
 * app loads — call it before the page's first goto.
 */
export const forceAuthChecks = async (page: Page) => {
  await page.addInitScript(() => {
    (window as Window & { __FORCE_AUTH_CHECKS__?: boolean }).__FORCE_AUTH_CHECKS__ = true;
  });
};

/** /ip/status with a chosen origin; default is a non-VPN US user. */
export const mockIpStatus = async (
  page: Page,
  { countryCode = 'US', isVpn = false }: { countryCode?: string; isVpn?: boolean } = {}
) => {
  await page.route('**/ip/status*', route =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({
        country_code: countryCode,
        is_vpn: isVpn,
        is_restricted_region: false
      })
    })
  );
};

/** /address/status: connect-time and pre-transaction screening both read this. */
export const mockAddressScreening = async (page: Page, { allowed = true }: { allowed?: boolean } = {}) => {
  await page.route('**/address/status*', route =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ addressAllowed: allowed })
    })
  );
};

/**
 * /terms-acceptance/check. `signed` controls whether the gate owes the
 * per-transaction signature; `messageToSign` rides along because the webapp
 * holds no copy of the text (APP-508).
 */
export const mockTermsCheck = async (
  page: Page,
  { accepted = false, signed = false }: { accepted?: boolean; signed?: boolean } = {}
) => {
  await page.route('**/terms-acceptance/check', route =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({
        accepted,
        signedForCurrentVersion: signed,
        latestVersion: '2026-08-01',
        messageToSign: MOCK_MESSAGE_TO_SIGN
      })
    })
  );
};

/**
 * Answers `personal_sign` at the RPC boundary; every other call falls back to
 * the previously-registered handlers (the fixtures' gas-limit rewrite). Pass
 * `reject: true` to simulate the wallet declining (EIP-1193 code 4001).
 * Returns a handle whose `mode` can be flipped mid-test — a retry can succeed
 * after a first attempt was rejected without re-registering routes.
 */
export const mockPersonalSign = async (
  page: Page,
  { reject = false, delayMs = 300 }: { reject?: boolean; delayMs?: number } = {}
) => {
  const handle = { mode: reject ? ('reject' as const) : ('sign' as const) } as {
    mode: 'reject' | 'sign';
  };
  await page.route(RPC_URL, async (route, request) => {
    const postData = request.postData() ?? '';
    // wagmi's mock connector rewrites `personal_sign` to `eth_sign` before
    // delegating to the transport, so both spellings mean "the wallet prompt".
    if (
      request.method() !== 'POST' ||
      !(postData.includes('"personal_sign"') || postData.includes('"eth_sign"'))
    ) {
      return route.fallback();
    }
    const { id } = JSON.parse(postData);
    // A beat of latency keeps the signature step observable as the current
    // step before it resolves.
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        handle.mode === 'reject'
          ? {
              jsonrpc: '2.0',
              id,
              error: { code: 4001, message: 'User rejected the request.' }
            }
          : {
              jsonrpc: '2.0',
              id,
              result: `0x${'ab'.repeat(65)}`
            }
      )
    });
  });
  return handle;
};
