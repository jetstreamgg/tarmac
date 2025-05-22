import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test('Linked Action - Upgrade DAI then supply to Savings', async ({ page }) => {
  await page.goto('?widget=upgrade&input_amount=100&linked_action=savings');
  await connectMockWalletAndAcceptTerms(page);

  const arrowStepIndicators = page.locator('[data-testid="arrow-step-indicator"]');
  await expect(arrowStepIndicators).toHaveCount(2);

  await approveOrPerformAction(page, 'Upgrade');

  const gotToSavingsButton = page.getByRole('button', { name: 'Go to Savings' }).first();
  await expect(gotToSavingsButton).toBeEnabled(); //don't click until enabled
  await gotToSavingsButton.click();

  await approveOrPerformAction(page, 'Supply');

  const finishButton = page.getByRole('button', { name: 'Back to Savings' }).first();
  await expect(finishButton).toBeEnabled(); // don't click until enabled
  await finishButton.click();
});
