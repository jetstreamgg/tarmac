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

const readDecisions = (page: import('@playwright/test').Page) =>
  page.evaluate((prefix: string) => {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
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
    // appears here and the cover starts the moment the wallet connects —
    // catch it live (a ~1.6s window). The real terms-modal flow, and the
    // loader waiting behind it, is pinned deterministically in
    // AppLoaderTermsFlow.test.tsx at the component level.
    await isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first().click();
    await expect(isolatedPage.getByTestId('app-loader')).toBeVisible({ timeout: 5000 });

    // The timeline hands off to the reveal and the overlay unmounts for good.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0, { timeout: 10_000 });
    await expect(isolatedPage.locator('.page-transition')).toHaveClass(/animate-app-loader-content-reveal/);
    await expect
      .poll(async () => isolatedPage.evaluate((key: string) => localStorage.getItem(key), PLAYED_KEY), {
        timeout: 10_000
      })
      .not.toBeNull();

    // The queries settle and the outcome lands in the per-address cache. A
    // fresh wallet is empty by construction, so the outcome is pinned: no
    // position and nothing idle resolves to the simulate pitch + Idle tab.
    await expect
      .poll(async () => readDecisions(isolatedPage), { timeout: 30_000 })
      .toMatchObject([{ outcome: 'simulate', tab: 'idle', updatedAt: expect.any(Number) }]);
    await expect(isolatedPage.getByTestId('savings-tvl-callout')).toBeVisible();

    // One-shot: with the page settled and the flag written, the loader never
    // comes back within this page load.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);
  });

  test('a returning browser skips the loader on connect', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    // Wait for the app to boot (it wipes localStorage as it does), THEN seed
    // the returning-user state the gates read at connect time.
    await expect(isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first()).toBeVisible();
    await isolatedPage.evaluate(
      ({ playedKey, decisionPrefix }: { playedKey: string; decisionPrefix: string }) => {
        localStorage.setItem(playedKey, String(Date.now()));
        localStorage.setItem(
          `${decisionPrefix}0x0000000000000000000000000000000000000001`,
          JSON.stringify({ outcome: 'simulate', tab: 'idle', updatedAt: Date.now() })
        );
      },
      { playedKey: PLAYED_KEY, decisionPrefix: DECISION_PREFIX }
    );

    await connectMockWalletAndAcceptTerms(isolatedPage);

    // Never covered, never revealed: the loader left no trace on the layout.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);
    await expect(isolatedPage.locator('.page-transition')).not.toHaveClass(
      /animate-app-loader-content-reveal/
    );

    // The connected page still settles and writes this wallet's own cache
    // entry alongside the seeded one.
    await expect
      .poll(async () => (await readDecisions(isolatedPage)).length, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
  });
});
