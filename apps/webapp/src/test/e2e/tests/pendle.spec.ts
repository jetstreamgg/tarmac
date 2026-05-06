import { expect, test } from '../fixtures-parallel.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

// E2E scaffold for the Pendle widget. All cases are skipped pending the
// follow-up PR that wires Pendle write hooks (approve + convert). Once those
// land, replace the `test.skip` calls with real implementations.

test.describe('Pendle (scaffold — write actions stubbed)', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  });

  test.skip('reaches the Fixed Yield module from the sidebar', async ({ isolatedPage }) => {
    await isolatedPage.getByRole('tab', { name: 'Fixed Yield' }).click();
    await expect(isolatedPage.getByText('Fixed Yield')).toBeVisible();
  });

  test.skip('opens a market detail page via deeplink ?market=<address>', async ({ isolatedPage }) => {
    await isolatedPage.goto(
      '/?widget=fixed&fixed_module=market&market=0xc5b32dba5f29f8395fb9591e1a15f23a75214f33'
    );
    await expect(isolatedPage.getByText('PT-USDG')).toBeVisible();
    await expect(isolatedPage.getByTestId('pendle-action-button')).toBeVisible();
  });

  test.skip('falls back to the overview when ?market=<unknown> is passed', async ({ isolatedPage }) => {
    await isolatedPage.goto(
      '/?widget=fixed&fixed_module=market&market=0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );
    await expect(isolatedPage.getByText('All markets')).toBeVisible();
  });

  test.skip('routing disclosure expands and collapses', async ({ isolatedPage }) => {
    await isolatedPage.goto(
      '/?widget=fixed&fixed_module=market&market=0xc5b32dba5f29f8395fb9591e1a15f23a75214f33'
    );
    const toggle = isolatedPage.getByTestId('pendle-routing-disclosure-toggle');
    await toggle.click();
    await expect(isolatedPage.getByText('Routed via Pendle')).toBeVisible();
  });

  test.skip('matured markets are hidden when wallet does not hold PT', async () => {
    // Requires Tenderly evm_increaseTime past PENDLE_MARKETS[0].expiry. Defer to
    // the follow-up PR that ships matured-state coverage end-to-end.
  });
});
