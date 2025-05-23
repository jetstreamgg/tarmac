import { lsMkrUsdsRewardAddress, mkrAddress, sealModuleAddress } from '@jetstreamgg/hooks';
import { expect, test } from '../fixtures';
import { setErc20Balance } from '../utils/setBalance';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { newSealPosition } from '../utils/newSealPosition';
import { approveToken } from '../utils/approveToken';
import { mkrAbi } from 'node_modules/@jetstreamgg/hooks/src/generated';
import { updateSealDebtCeiling } from '../utils/updateSealDebtCeiling';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { approveOrPerformAction } from '../utils/approveOrPerformAction';

test.beforeAll(async () => {
  await Promise.all([
    setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '1000'),
    approveToken(mkrAddress[TENDERLY_CHAIN_ID], sealModuleAddress[TENDERLY_CHAIN_ID], '100', mkrAbi),
    // Increase the debt ceiling in the seal module to the same value than in the stake module so we can open a position and borrow
    updateSealDebtCeiling(50000000000000000000000000000000000000000000000000000n)
  ]);

  // Create a new Seal position in the forked testnet before running the tests. Seal widget has the "Open new position" button disabled for the migration.
  await newSealPosition(
    '100',
    // Manually created delegate in the parent forked vnet
    '0x4e4393f93ac7ba34648a82ea2248d9bdbb1ff7e5',
    lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID],
    '38000'
  );

  // Restore the Seal debt ceiling to the initial value of 0 after creating position for a more realistic environment
  await updateSealDebtCeiling(0n);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/seal-engine');
  await connectMockWalletAndAcceptTerms(page);
});

test('Migrate Seal position to Staking position', async ({ page }) => {
  // positions overview
  await expect(page.getByText('Position 1')).toBeVisible();
  await expect(page.getByText('100 MKR')).toBeVisible();
  await expect(page.getByText('38,000 USDS')).toBeVisible();

  // Migrate about
  await page.getByRole('button', { name: 'Migrate Position' }).click();

  await expect(page.getByTestId('migrate-from-card').getByText('Seal Position 1')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('Open new Staking position')).toBeVisible();

  await page.getByRole('checkbox').click();
  await page.getByTestId('widget-button').first().click();

  // select rewards
  await expect(page.getByText('Choose your reward token')).toBeVisible();
  await page.getByRole('button', { name: 'USDS' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // select delegate
  await expect(page.getByText('Choose your delegate')).toBeVisible();
  await page.getByRole('button', { name: '0x8779' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // position summary
  await expect(page.getByTestId('position-summary-card').getByText('Collateral to migrate')).toBeVisible();
  await expect(page.getByTestId('position-summary-card').getByText('100 MKR')).toBeVisible();
  await expect(page.getByTestId('position-summary-card').getByText('Debt to migrate')).toBeVisible();
  await expect(page.getByTestId('position-summary-card').getByText('38,000 USDS')).toBeVisible();
  await expect(page.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();

  // Open staking position
  await approveOrPerformAction(page, 'Submit');
  await expect(
    page.getByText('Your staking position is now active. Next, start the migration process.')
  ).toBeVisible();

  // Approve migration contract
  await approveOrPerformAction(page, 'Begin migration');
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Migration contract approved')).toBeVisible();

  // Execute migration
  await approveOrPerformAction(page, 'Migrate');
  await expect(page.getByText('Confirm your migration')).toBeVisible();
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Success!')).toBeVisible();

  // Successful migration, now go to check position
  await page.goto('/?widget=stake');
  await connectMockWalletAndAcceptTerms(page);

  // Check that position 1 exists in stake module, and check the balances are the same than in the old seal position
  await expect(page.getByText('Position 1')).toBeVisible();
  await expect(page.getByText('2,400,000 SKY')).toBeVisible(); // 100 MKR * 24,000 = 2,400,000
  await expect(page.getByText('38,000 USDS')).toBeVisible();
});

test('Resume migration flow with a Staking position already created', async ({ page }) => {
  /*
   * Set up new Staking position
   */
  // Migrate about
  await page.getByRole('button', { name: 'Migrate Position' }).click();
  await page.getByRole('checkbox').click();
  await page.getByTestId('widget-button').first().click();

  // select rewards
  await expect(page.getByText('Choose your reward token')).toBeVisible();
  await page.getByRole('button', { name: 'USDS' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // select delegate
  await expect(page.getByText('Choose your delegate')).toBeVisible();
  await page.getByRole('button', { name: '0x8779' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // Open staking position
  await approveOrPerformAction(page, 'Submit');
  await expect(
    page.getByText('Your staking position is now active. Next, start the migration process.')
  ).toBeVisible();

  /*
   * Now reload page and attempt to resume the migration flow with the already created staking position
   */
  await page.goto('/seal-engine');
  await connectMockWalletAndAcceptTerms(page);

  // Migrate about
  await page.getByRole('button', { name: 'Migrate Position' }).click();

  await expect(page.getByTestId('migrate-from-card').getByText('Seal Position 1')).toBeVisible();
  await expect(page.getByTestId('migrate-from-card').getByText('100 MKR')).toBeVisible();
  await expect(page.getByTestId('migrate-from-card').getByText('38,000 USDS')).toBeVisible();

  await page.getByText('Select an option...').click();
  await page.getByTestId('select-position-dropdown').getByText('Position 1').click();

  // The data about the previously created staking position is visible
  await expect(page.getByTestId('migrate-to-card').getByText('Staking Position 1')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('100 MKR')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('2,400,000 SKY')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('38,000 USDS')).toBeVisible();

  await page.getByRole('checkbox').click();
  await approveOrPerformAction(page, 'Continue to migrate');

  // Continue
  // Approve migration contract
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Migration contract approved')).toBeVisible();

  // Execute migration
  await approveOrPerformAction(page, 'Migrate');
  await expect(page.getByText('Confirm your migration')).toBeVisible();
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Success!')).toBeVisible();

  // Successful migration, now go to check position
  await page.goto('/?widget=stake');
  await connectMockWalletAndAcceptTerms(page);

  // Check that position 1 exists in stake module, and check the balances are the same than in the old seal position
  await expect(page.getByText('Position 1')).toBeVisible();
  await expect(page.getByText('2,400,000 SKY')).toBeVisible(); // 100 MKR * 24,000 = 2,400,000
  await expect(page.getByText('38,000 USDS')).toBeVisible();
});

test('Resume migration flow with a Staking position already created and OldEngine already hoped', async ({
  page
}) => {
  /*
   * Set up new Staking position
   */
  // Migrate about
  await page.getByRole('button', { name: 'Migrate Position' }).click();
  await page.getByRole('checkbox').click();
  await page.getByTestId('widget-button').first().click();

  // select rewards
  await expect(page.getByText('Choose your reward token')).toBeVisible();
  await page.getByRole('button', { name: 'USDS' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // select delegate
  await expect(page.getByText('Choose your delegate')).toBeVisible();
  await page.getByRole('button', { name: '0x8779' }).click();
  await expect(page.getByTestId('widget-button').first()).toBeEnabled();
  await page.getByTestId('widget-button').first().click();

  // Open staking position
  await approveOrPerformAction(page, 'Submit');
  await expect(
    page.getByText('Your staking position is now active. Next, start the migration process.')
  ).toBeVisible();

  // Approve migration contract
  await approveOrPerformAction(page, 'Begin migration');
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Migration contract approved')).toBeVisible();

  /*
   * Now reload page and attempt to resume the migration flow with the already created staking position
   */
  await page.goto('/seal-engine');
  await connectMockWalletAndAcceptTerms(page);

  // Migrate about
  await page.getByRole('button', { name: 'Migrate Position' }).click();

  await expect(page.getByTestId('migrate-from-card').getByText('Seal Position 1')).toBeVisible();
  await expect(page.getByTestId('migrate-from-card').getByText('100 MKR')).toBeVisible();
  await expect(page.getByTestId('migrate-from-card').getByText('38,000 USDS')).toBeVisible();

  await page.getByText('Select an option...').click();
  await page.getByTestId('select-position-dropdown').getByText('Position 1').click();

  // The data about the previously created staking position is visible
  await expect(page.getByTestId('migrate-to-card').getByText('Staking Position 1')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('100 MKR')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('2,400,000 SKY')).toBeVisible();
  await expect(page.getByTestId('migrate-to-card').getByText('38,000 USDS')).toBeVisible();

  await page.getByRole('checkbox').click();

  // Continue - Approve migration contract should be skipped, we already approved it
  // Execute migration
  await approveOrPerformAction(page, 'Continue to migrate');
  await expect(page.getByText('Confirm your migration')).toBeVisible();
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Success!')).toBeVisible();

  // Successful migration, now go to check position
  await page.goto('/?widget=stake');
  await connectMockWalletAndAcceptTerms(page);

  // Check that position 1 exists in stake module, and check the balances are the same than in the old seal position
  await expect(page.getByText('Position 1')).toBeVisible();
  await expect(page.getByText('2,400,000 SKY')).toBeVisible(); // 100 MKR * 24,000 = 2,400,000
  await expect(page.getByText('38,000 USDS')).toBeVisible();
});
