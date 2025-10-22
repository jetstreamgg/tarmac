import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test('Linked Action - Upgrade DAI then get reward', async ({ isolatedPage }) => {
  await isolatedPage.goto(
    '?widget=upgrade&input_amount=100&linked_action=rewards&reward=0x0650CAF159C5A49f711e8169D4336ECB9b950275'
  );
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  const arrowStepIndicators = isolatedPage.locator('[data-testid="arrow-step-indicator"]');
  await expect(arrowStepIndicators).toHaveCount(2);

  await performAction(isolatedPage, 'Upgrade');

  await isolatedPage.getByRole('button', { name: 'Go to Rewards' }).first().click();

  await performAction(isolatedPage, 'Supply');

  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).first().click();
});
