import { expect, type Page } from '@playwright/test';
import { interceptAndRejectTransactions } from './rejectTransaction';

export type Action =
  | 'Supply'
  | 'Withdraw'
  | 'Swap'
  | 'Upgrade'
  | 'Revert'
  | 'Trade'
  | 'Continue'
  | 'Confirm'
  | 'Submit'
  | 'Begin migration'
  | 'Migrate'
  | 'Continue to migrate'
  | 'Open a position'
  | 'Change Position'
  | 'Confirm your position'
  | 'Convert';

type approveOrPerformActionOptions = {
  reject?: boolean;
  buttonPosition?: number;
  review?: boolean;
};

export const approveOrPerformAction = async (
  page: Page,
  action: Action,
  options?: approveOrPerformActionOptions
) => {
  const { reject = false, buttonPosition = 0, review = true } = options || {};

  if (review) {
    await page.getByTestId('widget-button').getByText('Review').click();
  }

  const widgetButton = page.getByTestId('widget-button').nth(buttonPosition);
  await widgetButton.waitFor({ state: 'attached' }); // Ensure the button is in the DOM
  await expect(widgetButton).toHaveText(/^Confirm/);
  await expect(widgetButton).toBeEnabled(); // Wait for the button to be enabled

  if (reject) {
    await interceptAndRejectTransactions(page, 200, true);
  }
  await widgetButton.click();
  const stepIndicator = page.getByTestId('step-indicator').last();
  const isStepIndicatorVisible = await stepIndicator.isVisible();
  // Some flows that don't require approval like rewards withdraw and mainnet savings withdraw don't show the step indicator
  if (isStepIndicatorVisible) {
    await expect(stepIndicator).toHaveText(action);
  }
};

export const performAction = async (page: Page, action: Action, options?: approveOrPerformActionOptions) => {
  const { review = true, reject = false } = options || {};
  if (review) {
    await page.getByTestId('widget-button').getByText('Review').first().click();
  }

  const actionButton = page
    // 'Confirm bundled transaction' is the expected value for approve + action flows
    // The alternative is 'Confirm' + [single action], but never 'Confirm 2 transactions' as that
    // would be a non batch flow
    .locator('role=button >> text=/^(Confirm bundled transaction|Confirm(?! 2 transactions).*)$/')
    .nth(0);
  await actionButton.waitFor({ state: 'attached' }); // Ensure the button is in the DOM
  await expect(actionButton).toBeEnabled(); // Wait for the button to be enabled
  if (reject) {
    await interceptAndRejectTransactions(page, 200, true);
  }
  await actionButton.click();
  // regex for success or success!, can be any capital case
  await page
    .getByText(/success|success!|Success|Successfully withdrawn|error/i)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  // await page.waitForTimeout(1000);

  const stepIndicator = page.getByTestId('step-indicator').last();
  const isStepIndicatorVisible = await stepIndicator.isVisible();
  // Some flows that don't require approval like rewards withdraw and mainnet savings withdraw don't show the step indicator
  if (isStepIndicatorVisible) {
    await expect(stepIndicator).toHaveText(action);
  }
};

/**
 * On the Review screen, clicks the "Bundle transactions" toggle switch to turn
 * off bundled (batch) transactions, switching the flow to sequential mode.
 *
 * Must be called after navigating to the Review screen (after clicking Review).
 * The toggle is only visible when connected with a batch-capable wallet.
 *
 * After calling this, the confirm button text will change to "Confirm 2 transactions".
 */
export const disableBundledTx = async (page: Page) => {
  const toggle = page.getByRole('switch');
  await toggle.waitFor({ state: 'visible' });
  // Only click if currently checked (bundled on)
  const isChecked = await toggle.isChecked();
  if (isChecked) {
    await toggle.click();
  }
  // Wait for button to reflect sequential mode
  await expect(page.getByTestId('widget-button').last()).toHaveText(
    /^Confirm 2 transactions|^Confirm (?!bundled)/,
    { timeout: 5000 }
  );
};

type performSequentialActionOptions = {
  /** Whether to reject the step-2 transaction (simulate wallet rejection after approve). */
  rejectStep2?: boolean;
};

/**
 * Performs a full sequential (non-batch) two-step transaction flow:
 * 1. Clicks Review
 * 2. Toggles bundled transactions off
 * 3. Clicks "Confirm 2 transactions" (triggers the approve tx — auto-confirmed by mock wallet)
 * 4. Waits for step 2 to auto-execute and for a success/error result
 *
 * Use this helper when testing sequential flows (batch toggle OFF).
 * Requires connecting with { batch: true } so the toggle is visible.
 *
 * For flows that only need one transaction (no approval), use performAction instead.
 */
export const performSequentialAction = async (
  page: Page,
  action: Action,
  options?: performSequentialActionOptions
) => {
  const { rejectStep2 = false } = options || {};

  await page.getByTestId('widget-button').getByText('Review').first().click();

  // await disableBundledTx(page);

  const confirmButton = page.getByTestId('widget-button').last();
  await confirmButton.waitFor({ state: 'attached' });
  await expect(confirmButton).toBeEnabled();

  if (rejectStep2) {
    // Allow the approve (step 1) to go through, then reject step 2
    await confirmButton.click();
    // Wait for step 1 (Approve) step-indicator to complete before arming the rejection
    await expect(page.getByTestId('step-indicator').first()).toHaveText('Approve', { timeout: 15000 });
    await interceptAndRejectTransactions(page, 200, true);
  } else {
    await confirmButton.click();
  }

  // Wait for success or error
  await page
    .getByText(/success|success!|Success|Successfully withdrawn|error/i)
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });

  if (!rejectStep2) {
    const stepIndicator = page.getByTestId('step-indicator').last();
    const isStepIndicatorVisible = await stepIndicator.isVisible();
    if (isStepIndicatorVisible) {
      await expect(stepIndicator).toHaveText(action, { timeout: 10000 });
    }
  }
};
