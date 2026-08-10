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

test.describe('app loader and portfolio decision cache', () => {
  test('first connect plays the loader once and caches the settled decision', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');

    // Disconnected entry: no loader.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);

    await connectMockWalletAndAcceptTerms(isolatedPage);

    // The connect helper waits out the cover (~2.2s), so assert its traces:
    // the played flag is set and the reveal ran on the page content.
    await expect
      .poll(async () => isolatedPage.evaluate((key: string) => localStorage.getItem(key), PLAYED_KEY), {
        timeout: 10_000
      })
      .not.toBeNull();
    await expect(isolatedPage.locator('.page-transition')).toHaveClass(/animate-app-loader-content-reveal/);
    // And it is gone once the timeline finished.
    await expect(isolatedPage.getByTestId('app-loader')).toHaveCount(0);

    // The queries settle and the outcome lands in the per-address cache. Pool
    // accounts are funded (a live savings position), so don't pin the outcome
    // — assert a well-formed decision was written for this wallet.
    await expect
      .poll(async () => readDecisions(isolatedPage), { timeout: 30_000 })
      .toMatchObject([
        {
          outcome: expect.stringMatching(/^(none|allocate|simulate)$/),
          tab: expect.stringMatching(/^(supplied|idle)$/),
          updatedAt: expect.any(Number)
        }
      ]);

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
