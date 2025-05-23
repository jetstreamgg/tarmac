import { expect, type Page } from '@playwright/test';
import { interceptAndRejectTransactions } from './rejectTransaction';

export type Action =
  | 'Supply'
  | 'Withdraw'
  | 'Upgrade'
  | 'Revert'
  | 'Trade'
  | 'Approve'
  | 'Approve supply amount'
  | 'Approve seal amount'
  | 'Approve staking amount'
  | 'Approve repay amount'
  | 'Continue'
  | 'Confirm'
  | 'Submit'
  | 'Begin migration'
  | 'Migrate'
  | 'Continue to migrate';

type approveOrPerformActionOptions = {
  reject?: boolean;
  buttonName?: 'Retry' | 'Continue';
  buttonPosition?: number;
};

export const approveOrPerformAction = async (
  page: Page,
  action: Action,
  options?: approveOrPerformActionOptions
) => {
  const { reject = false, buttonName = 'Continue', buttonPosition = 0 } = options || {};

  const actionButton = page
    .locator(`role=button >> text=/^(${action}|Approve ${action.toLowerCase()} amount)$/`)
    .nth(buttonPosition);
  await actionButton.waitFor({ state: 'attached' }); // Ensure the button is in the DOM
  await expect(actionButton).toBeEnabled(); // Wait for the button to be enabled
  const buttonText = await actionButton.innerText(); // Get the text of the button

  if (buttonText === action) {
    //already have allowance
    if (reject) {
      await interceptAndRejectTransactions(page, 200, true);
    }
    await actionButton.click();
  } else {
    //need allowance
    await page.getByRole('button', { name: 'Approve' }).click();

    if (reject) {
      await expect(page.locator('role=button[name="Continue"]').first()).toBeEnabled();
      await interceptAndRejectTransactions(page, 200, true);
    }
    await page.locator(`role=button[name="${buttonName}"]`).first().click(); //for some reason there's another button named Next
  }
};
