import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { switchNetworkOnProductPage, switchWalletNetwork } from '../utils/switchWalletNetwork';

// Centralized navigate-and-switch behavior (docs/network-switching-test-matrix.md):
// navigation to a module always lands; if the module isn't available on the
// current network the app switches the wallet on the user's behalf (announced
// by the network toast) or, when the wallet doesn't honor it, falls back to
// Portfolio. In the mock build every chain is tenderly-flavored — 'Tenderly
// Base' keeps the real Base chain id (8453) so it behaves as a genuine L2,
// and the L2 switch target is the config fork: network=tenderlymainnet.

const AUTO_SWITCH_COPY = (widget: string) =>
  `To access ${widget}, you need to be on mainnet. We've switched your network automatically.`;
const GENERIC_COPY = 'The network has changed';

/** Connect on Portfolio, then move the wallet to Tenderly Base (8453) and wait
 * out the manual-switch toast so later toast assertions start clean. */
const connectOnBase = async (page: Page) => {
  await page.goto('/portfolio');
  await connectMockWalletAndAcceptTerms(page);
  await switchWalletNetwork(page, 'Tenderly Base');
  await expect(page).toHaveURL(/network=tenderlybase/);
  await expect(page.getByText(GENERIC_COPY)).toHaveCount(0, { timeout: 15000 });
};

test.describe('Network switching on navigation (V2 shell)', () => {
  // A1: TopNav to a mainnet-only module from an L2 — switch + explanatory toast.
  test('TopNav Stake from Base switches to the fork and explains why', async ({ isolatedPage }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.getByTestId('nav-stake').click();

    await expect(isolatedPage).toHaveURL(/\/stake\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByText(AUTO_SWITCH_COPY('Stake'))).toBeVisible();
    // The toast shows the from → to chains.
    await expect(isolatedPage.getByText('Tenderly Base').first()).toBeVisible();
    await expect(isolatedPage.getByText('Tenderly Mainnet').first()).toBeVisible();
    await expect(isolatedPage.getByTestId('stake-network')).toBeVisible();
  });

  // A2 + A13 control: the Earn marketplace itself never switches; a
  // mainnet-only row (Fixed) switches on landing at the detail page.
  test('Earn marketplace renders on Base; a Fixed row switches on landing', async ({ isolatedPage }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.getByTestId('nav-earn').click();
    await expect(isolatedPage).toHaveURL(/\/earn\?.*network=tenderlybase/);
    await expect(isolatedPage.getByTestId('earn-opportunities-table')).toBeVisible();

    await isolatedPage.locator('[data-testid^="earn-row-fixed-"]').first().click();

    await expect(isolatedPage).toHaveURL(/\/earn\/fixed\/[a-z0-9-]+\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByText(AUTO_SWITCH_COPY('Fixed Yield'))).toBeVisible();
    await expect(isolatedPage.getByTestId('product-detail-network')).toBeVisible();
  });

  // A14 cross-check: same behavior for the stUSDS (Expert) row.
  test('Earn stUSDS row from Base switches to the fork', async ({ isolatedPage }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.getByTestId('nav-earn').click();
    await isolatedPage.getByTestId('earn-row-stusds').click();

    await expect(isolatedPage).toHaveURL(/\/earn\/stusds\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByText(AUTO_SWITCH_COPY('stUSDS'))).toBeVisible();
    await expect(isolatedPage.getByTestId('product-detail-network')).toBeVisible();
  });

  // A12 control: a multichain destination (Savings) keeps the L2 — no switch, no toast.
  test('Savings from Base stays on Base with no switch and no toast', async ({ isolatedPage }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.getByTestId('nav-earn').click();
    await isolatedPage.getByTestId('earn-row-savings').click();

    await expect(isolatedPage).toHaveURL(/\/earn\/savings\?.*network=tenderlybase/);
    await expect(isolatedPage.getByTestId('product-detail-network')).toBeVisible();
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);
    await expect(isolatedPage.getByText(GENERIC_COPY)).toHaveCount(0);
  });

  // D2: already on the fork — mainnet-only modules render untouched.
  test('Stake on Tenderly Mainnet renders directly with no switch and no toast', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage);

    await isolatedPage.getByTestId('nav-stake').click();

    await expect(isolatedPage).toHaveURL(/\/stake\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByTestId('stake-network')).toBeVisible();
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);
    await expect(isolatedPage.getByText(GENERIC_COPY)).toHaveCount(0);
  });

  // B1 + B3: a rejected switch bounces home once (URL never claims the wrong
  // network, no re-prompt), and the next visit to the module prompts again.
  test('rejected switch falls back to Portfolio; retrying the module prompts again', async ({
    isolatedPage
  }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.evaluate(() => {
      window.__MOCK_SWITCH_CHAIN_ERROR__ = 'reject';
    });
    await isolatedPage.getByTestId('nav-stake').click();

    await expect(isolatedPage).toHaveURL(/\/portfolio\?.*network=tenderlybase/);
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);

    // The failure consumed the hook, so a fresh visit switches normally (B3).
    await isolatedPage.getByTestId('nav-stake').click();
    await expect(isolatedPage).toHaveURL(/\/stake\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByText(AUTO_SWITCH_COPY('Stake'))).toBeVisible();
  });

  // B2: a non-rejection wallet failure (-32002 pending) behaves exactly like a rejection.
  test('wallet switch error falls back to Portfolio identically', async ({ isolatedPage }) => {
    await connectOnBase(isolatedPage);

    await isolatedPage.evaluate(() => {
      window.__MOCK_SWITCH_CHAIN_ERROR__ = 'error';
    });
    await isolatedPage.getByTestId('nav-stake').click();

    await expect(isolatedPage).toHaveURL(/\/portfolio\?.*network=tenderlybase/);
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);
  });

  // E1: a manual wallet switch wins — leaving a mainnet-only page redirects
  // home with the generic toast and never prompts to switch back.
  test('manual switch to Base while on Stake redirects to Portfolio', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage);
    await isolatedPage.getByTestId('nav-stake').click();
    await expect(isolatedPage.getByTestId('stake-network')).toBeVisible();

    await switchWalletNetwork(isolatedPage, 'Tenderly Base');

    await expect(isolatedPage).toHaveURL(/\/portfolio\?.*network=tenderlybase/);
    await expect(isolatedPage.getByText(GENERIC_COPY).first()).toBeVisible();
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);
  });

  // E2: a manual switch on a multichain page stays put, syncs the param, and
  // the generic toast offers the quick-switch chains.
  test('manual switch to Base while on Savings stays with quick-switch toast', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage);
    await isolatedPage.getByTestId('nav-earn').click();
    await isolatedPage.getByTestId('earn-row-savings').click();
    await expect(isolatedPage.getByTestId('product-detail-network')).toBeVisible();

    await switchWalletNetwork(isolatedPage, 'Tenderly Base');

    await expect(isolatedPage).toHaveURL(/\/earn\/savings\?.*network=tenderlybase/);
    await expect(isolatedPage.getByText(GENERIC_COPY).first()).toBeVisible();
    await expect(isolatedPage.getByText('Savings is also supported on:')).toBeVisible();
  });

  // The in-app switch path that replaced the wallet drawer's chain modal: a
  // product page's network dropdown. Savings runs on every chain, so its
  // selector is the one that offers a real choice.
  test('the Savings network dropdown switches the wallet and syncs the param', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage);
    await isolatedPage.getByTestId('nav-earn').click();
    await isolatedPage.getByTestId('earn-row-savings').click();
    await expect(isolatedPage.getByTestId('product-detail-network')).toBeVisible();

    await switchNetworkOnProductPage(isolatedPage, 'Tenderly Base');

    await expect(isolatedPage).toHaveURL(/\/earn\/savings\?.*network=tenderlybase/);
    // The pill names where the product now is, and the page stayed put —
    // Savings runs on Base.
    await expect(isolatedPage.getByTestId('product-detail-network')).toContainText('Tenderly Base');
  });

  // A mainnet-only product has nothing to choose between, so its pill is a
  // plain label — no dropdown to open.
  test('the Stake network pill is static — one supported chain', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage);
    await isolatedPage.getByTestId('nav-stake').click();

    const pill = isolatedPage.getByTestId('stake-network');
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(isolatedPage.getByRole('listbox')).toHaveCount(0);
  });

  // C2: a disconnected deep link at an L2 param is corrected silently — the
  // store chain (fork) never left, so nothing announces a change.
  test('disconnected deep link /stake?network=tenderlybase corrects the param silently', async ({
    isolatedPage
  }) => {
    await isolatedPage.goto('/stake?network=tenderlybase');

    await expect(isolatedPage).toHaveURL(/\/stake\?.*network=tenderlymainnet/);
    await expect(isolatedPage.getByTestId('stake-network')).toBeVisible();
    await expect(isolatedPage.getByText(/To access/)).toHaveCount(0);
  });

  // C3: a garbage network param falls back to the store chain and renders.
  test('disconnected deep link with a garbage network param still renders Stake', async ({
    isolatedPage
  }) => {
    await isolatedPage.goto('/stake?network=foobar');

    await expect(isolatedPage).toHaveURL(/\/stake\?/);
    await expect(isolatedPage.getByTestId('stake-network')).toBeVisible();
  });
});
