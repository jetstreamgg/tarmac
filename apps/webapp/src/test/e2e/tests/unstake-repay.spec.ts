import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.js';

test.beforeEach(async ({ isolatedPage }) => {
  console.log('Starting beforeEach');
  await isolatedPage.goto('/');
  console.log('Navigated to /');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  console.log('Connected wallet');
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Stake & Borrow' }).click();
  console.log('Clicked Stake & Borrow tab');
});

test('Delegate checkbox and UI elements in Unstake and Repay tab', async ({ isolatedPage }) => {
  // 1. Create a position first so we can manage it
  const SKY_AMOUNT_TO_LOCK = '2400000';
  const USDS_AMOUNT_TO_BORROW = '38000';

  await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_LOCK);
  await isolatedPage.getByTestId('borrow-input-lse').first().fill(USDS_AMOUNT_TO_BORROW);
  await isolatedPage.waitForTimeout(2000); // Wait for simulation
  const buttonText = await isolatedPage.getByTestId('widget-button').first().textContent();
  console.log('Button text:', buttonText);
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 20000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // Select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // Select delegate (skip)

  // Confirm position
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await isolatedPage.getByTestId('widget-button').first().click(); // "Open a position"

  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 20000 });

  // 2. Go to Manage Position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();

  // 3. Switch to "Unstake and pay back" tab
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();

  // --- Test Case: Delegate Checkbox ---
  // Verify the delegate checkbox exists
  const delegateCheckbox = isolatedPage.getByRole('checkbox', {
    name: /Do you want to delegate voting power?/i
  });
  await expect(delegateCheckbox).toBeVisible();
  await expect(delegateCheckbox).toBeEnabled();
  await expect(delegateCheckbox).not.toBeChecked();
});

test('Unstake and Repay - No Debt UI', async ({ isolatedPage }) => {
  // 1. Create a position with debt
  const SKY_AMOUNT_TO_LOCK = '2400000';
  const USDS_AMOUNT_TO_BORROW = '38000';

  await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_LOCK);
  await isolatedPage.getByTestId('borrow-input-lse').first().fill(USDS_AMOUNT_TO_BORROW);
  await isolatedPage.waitForTimeout(2000); // Wait for simulation
  await isolatedPage.getByTestId('widget-button').first().click();

  // Select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();
  // Delegate screen might be skipped if checkbox not checked

  // Confirm position
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await isolatedPage.getByTestId('widget-button').first().click();
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 20000 });

  // 2. Go to Manage Position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();

  // 3. Repay 100% of debt
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();
  await isolatedPage.getByRole('button', { name: '100%' }).nth(1).click();
  await isolatedPage.getByTestId('widget-button').first().click();

  // Select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // Confirm repayment
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await isolatedPage.getByTestId('widget-button').first().click();
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 20000 });

  // 4. Verify No Debt UI
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();

  // Verify "You have no debt to repay" is visible in the limit text or similar
  await expect(isolatedPage.getByTestId('repay-input-lse-balance')).toContainText(
    'You have no debt to repay'
  );

  // Verify Info Message is NOT visible
  await expect(isolatedPage.getByText('You cannot repay your full USDS balance')).not.toBeVisible();

  // Verify Gas Icon is NOT visible
  const balanceElement = isolatedPage.getByTestId('repay-input-lse-balance');
  const parent = balanceElement.locator('..');
  const icon = parent.locator('svg');
  await expect(icon).not.toBeVisible();
});
