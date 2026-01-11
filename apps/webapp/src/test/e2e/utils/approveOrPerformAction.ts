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
  | 'Confirm your position';

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
    .getByText(/success|success!|Successfully withdrawn|error/i)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  const stepIndicator = page.getByTestId('step-indicator').last();
  const isStepIndicatorVisible = await stepIndicator.isVisible();
  // Some flows that don't require approval like rewards withdraw and mainnet savings withdraw don't show the step indicator
  if (isStepIndicatorVisible) {
    await expect(stepIndicator).toHaveText(action, { timeout: 10000 });
  }
};
