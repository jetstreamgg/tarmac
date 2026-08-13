import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

/**
 * First-visit app loader + cached portfolio decision (APP-419).
 *
 * Harness constraint: the mock-wallet wagmi config clears ALL localStorage at
 * app boot (config.e2e.ts, to drop cached-address state), so nothing seeded
 * before boot survives and nothing persists across reloads here. Every page
 * load is therefore a "first visit" — which is exactly the loader's play
 * condition — and returning-user state must be seeded AFTER the app boots,
 * before connecting. Cross-reload persistence is covered by unit/component
 * tests instead.
 */

const PLAYED_KEY = 'appLoader:v1:played';
const DECISION_PREFIX = 'portfolioDecision:v1:';

// Per-address entries only — the `$last` landing pointer is asserted apart.
const readDecisions = (page: import('@playwright/test').Page) =>
  page.evaluate((prefix: string) => {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix) && !k.endsWith('$last'))
      .map(k => JSON.parse(localStorage.getItem(k)!));
  }, DECISION_PREFIX);

/**
 * A wallet outside the funded pool: an empty wallet pins the settled decision
 * to the simulate pitch + Idle tab, where pool accounts carry positions. The
 * mock connector needs no key, and the loader flow needs no funds.
 */
const throwawayAddress = (): string =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;

test.describe('app loader and portfolio decision cache', () => {
  test('the root path lands on Earn for an unknown visitor', async ({ isolatedPage }) => {
    // Fresh context, nothing cached: Earn is the default home (APP-295). The
    // Portfolio branch (cached `$last` outcome `none`) can't be exercised
    // here — the mock-wallet boot wipes localStorage before the redirect
    // reads it — and is pinned in routes/destinations.test.ts instead.
    await isolatedPage.goto('/');
    await expect(isolatedPage).toHaveURL(/\/earn(\?|$)/);
  });

  test('first connect plays the loader once and caches the settled decision', async ({ isolatedPage }) => {
    // Override the pool account injected by the fixture (page init scripts
    // run after the context's, so this write wins) with the empty wallet.
    await isolatedPage.addInitScript((account: string) => {
      (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__ = account;
    }, throwawayAddress());
    await isolatedPage.goto('/portfolio');

    // Disconnected entry: no loader.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);

    // Terms are auto-accepted in every e2e environment (VITE_SKIP_AUTH_CHECK,
    // set in .env locally and in all the e2e workflows), so the modal never
    // appears here and the held cover starts the moment the wallet connects —
    // catch it live. The real terms-modal flow, and the loader waiting behind
    // it, is pinned deterministically in AppLoaderTermsFlow.test.tsx.
    await isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first().click();
    await expect(isolatedPage.getByTestId('app-loader')).toBeVisible({ timeout: 5000 });

    // The cover holds until the landing decision settles, then sorts: an
    // empty wallet has no position, so /portfolio was the wrong home — the
    // reveal lands on /earn (Routing & IA #3 / APP-295).
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0, { timeout: 15_000 });
    await expect(isolatedPage).toHaveURL(/\/earn(\?|$)/);
    await expect(isolatedPage.locator('.page-transition')).toHaveClass(/animate-app-loader-content-reveal/);
    await expect
      .poll(async () => isolatedPage.evaluate((key: string) => localStorage.getItem(key), PLAYED_KEY), {
        timeout: 10_000
      })
      .not.toBeNull();

    // The sorted outcome is cached for the wallet — empty pins it to the
    // simulate pitch + Idle tab — and mirrored to the `$last` pointer that
    // the "/" redirect reads.
    await expect
      .poll(async () => readDecisions(isolatedPage), { timeout: 30_000 })
      .toMatchObject([{ outcome: 'simulate', tab: 'idle', updatedAt: expect.any(Number) }]);
    await expect
      .poll(async () =>
        isolatedPage.evaluate(() => JSON.parse(localStorage.getItem('portfolioDecision:v1:$last') ?? 'null'))
      )
      .toMatchObject({ outcome: 'simulate' });

    // One-shot: with the page settled and the flag written, the loader never
    // comes back within this page load.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);
  });

  test('a returning wallet (cached decision) skips the loader on connect', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    // Wait for the app to boot (it wipes localStorage as it does), THEN seed
    // the returning-wallet state: the held cover is gated per address, so the
    // decision must belong to the account the fixture is about to connect.
    await expect(isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first()).toBeVisible();
    const seededAt = await isolatedPage.evaluate(
      ({ playedKey, decisionPrefix }: { playedKey: string; decisionPrefix: string }) => {
        const account = (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__;
        localStorage.setItem(playedKey, String(Date.now()));
        // An old-but-valid stamp, so the rewrite after settle is observable.
        // Pool accounts are funded: outcome `none` matches /portfolio, so the
        // cached hint triggers no redirect either.
        const updatedAt = Date.now() - 60 * 60 * 1000;
        localStorage.setItem(
          `${decisionPrefix}${account.toLowerCase()}`,
          JSON.stringify({ outcome: 'none', tab: 'supplied', updatedAt })
        );
        return updatedAt;
      },
      { playedKey: PLAYED_KEY, decisionPrefix: DECISION_PREFIX }
    );

    await connectMockWalletAndAcceptTerms(isolatedPage);

    // Never covered, never revealed, never redirected: the loader left no
    // trace on the layout and the cached hint matched the surface.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);
    await expect(isolatedPage.locator('.page-transition')).not.toHaveClass(
      /animate-app-loader-content-reveal/
    );
    await expect(isolatedPage).toHaveURL(/\/portfolio(\?|$)/);

    // The connected page still settles and rewrites this wallet's entry.
    await expect
      .poll(
        async () => Math.max(0, ...(await readDecisions(isolatedPage)).map(d => d.updatedAt as number)),
        { timeout: 30_000 }
      )
      .toBeGreaterThan(seededAt);
  });

  test('a new wallet still gets the held cover in a browser that already played', async ({
    isolatedPage
  }) => {
    // The played flag is per browser, but the fetch and sort are per wallet:
    // a second address with no cached decision is covered while its own data
    // loads, and lands sorted (empty wallet → /earn).
    await isolatedPage.addInitScript((account: string) => {
      (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__ = account;
    }, throwawayAddress());
    await isolatedPage.goto('/portfolio');
    await expect(isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first()).toBeVisible();
    await isolatedPage.evaluate(
      (playedKey: string) => localStorage.setItem(playedKey, String(Date.now())),
      PLAYED_KEY
    );

    await isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first().click();
    await expect(isolatedPage.getByTestId('app-loader')).toBeVisible({ timeout: 5000 });
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0, { timeout: 15_000 });
    await expect(isolatedPage).toHaveURL(/\/earn(\?|$)/);
  });
});
