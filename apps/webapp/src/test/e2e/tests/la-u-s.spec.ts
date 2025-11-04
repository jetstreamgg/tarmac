import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test('Linked Action - Upgrade DAI then supply to Savings', async ({ isolatedPage }) => {
  await isolatedPage.goto('?widget=upgrade&input_amount=100&linked_action=savings');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);

  const arrowStepIndicators = isolatedPage.locator('[data-testid="arrow-step-indicator"]');
  await expect(arrowStepIndicators).toHaveCount(2);

  await performAction(isolatedPage, 'Upgrade');

  const gotToSavingsButton = isolatedPage.getByRole('button', { name: 'Go to Savings' }).first();
  await expect(gotToSavingsButton).toBeEnabled(); //don't click until enabled
  await gotToSavingsButton.click();

  await performAction(isolatedPage, 'Supply');

  const finishButton = isolatedPage.getByRole('button', { name: 'Back to Savings' }).first();
  await expect(finishButton).toBeEnabled(); // don't click until enabled
  await finishButton.click();
});
