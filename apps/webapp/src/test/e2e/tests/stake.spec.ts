import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
// import { setErc20Balance } from '../utils/setBalance.js';
// import { skyAddress, usdsAddress } from '@jetstreamgg/sky-hooks';
// import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
// import { NetworkName } from '../utils/constants.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.js';

test.beforeAll(async () => {});

test.beforeEach(async ({ isolatedPage }) => {
  // await Promise.all([
  //   setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '100000000', 18, NetworkName.mainnet, testAccount),
  //   setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '1', 18, NetworkName.mainnet, testAccount)
  // ]);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Stake' }).click();
});

test('Lock SKY, select rewards, select delegate, and open position', async ({ isolatedPage }) => {
  // const SKY_AMOUNT = '100000000';
  // const USDS_AMOUNT = '38000';
  // const expectedSkyBalance = '100,000,000';
  // const expectedUsdsBalance = '38,000';

  const SKY_AMOUNT = '300';
  const USDS_AMOUNT = '38';
  const SKY_AMOUNT_TO_LOCK = '240';
  const USDS_AMOUNT_TO_BORROW = '38';
  const expectedSkyBalance = '300';
  // const expectedUsdsBalance = '38';

  // await isolatedPage.getByRole('button', { name: 'Open a new position' }).click();
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText(
    `${expectedSkyBalance} SKY`
  );

  // fill seal and borrow inputs and click next
  await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_LOCK);
  await isolatedPage.getByTestId('borrow-input-lse').fill(USDS_AMOUNT_TO_BORROW);

  // // TODO: check all the params
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // select delegate
  await expect(isolatedPage.getByText('Choose your delegate')).toBeVisible();
  await isolatedPage
    .getByTestId(/^delegate-card-/)
    .first()
    .click(); // select the first delegate using data-testid
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // position summary
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible({ timeout: 10000 });
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking').first()).toBeVisible();
  await expect(isolatedPage.getByText(`${SKY_AMOUNT_TO_LOCK} SKY`)).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Borrowing')).toBeVisible();
  await expect(isolatedPage.getByText(`${USDS_AMOUNT_TO_BORROW} USDS`)).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();

  // confirm position
  await performAction(isolatedPage, 'Open a position', { review: false });

  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText(
      `You've borrowed ${USDS_AMOUNT} USDS by staking ${SKY_AMOUNT} SKY. Your new position is open.`
    )
  ).toBeVisible();

  // positions overview
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // manage position
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();
  await expect(isolatedPage.getByTestId('borrow-input-lse-balance')).toHaveText(/Limit 0 <> .+ USDS/);

  // borrow more and skip rewards and delegate selection
  await isolatedPage.getByTestId('borrow-input-lse').fill(USDS_AMOUNT_TO_BORROW);
  await expect(isolatedPage.getByText('Insufficient collateral')).not.toBeVisible();
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).click();
  await expect(isolatedPage.getByText('Change your delegate')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Change Position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText(`You've borrowed ${USDS_AMOUNT_TO_BORROW} USDS. Your position is updated.`)
  ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // repay all
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();
  await expect(isolatedPage.getByTestId('borrow-input-lse-balance')).toHaveText(/Limit 0 <> .+ USDS/);

  // switch tabs
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();
  await expect(isolatedPage.getByTestId('repay-input-lse-balance')).toHaveText(/Limit 0 <> .+, or .+ USDS/);

  // click repay 100% button
  await isolatedPage.getByRole('button', { name: '100%' }).nth(1).click();

  // due to stability fee accumulation, the exact repay amount will change based on time
  const repayValue = Number(await isolatedPage.getByTestId('repay-input-lse').inputValue());
  expect(repayValue).toBeGreaterThan(USDS_AMOUNT_TO_BORROW);
  expect(repayValue).toBeLessThan(38101);
  await isolatedPage.getByTestId('widget-button').first().click();

  // skip the rewards and delegates and confirm position
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).click();
  await expect(isolatedPage.getByText('Change your delegate')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();

  await performAction(isolatedPage, 'Change Position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText(`You've repaid ${USDS_AMOUNT_TO_BORROW} USDS to exit your position.`)
  ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // unseal all
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // switch tabs
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('2,400,000 SKY');

  // fill some SKY and proceed to skip the rewards and delegates and confirm position
  await isolatedPage.getByTestId('supply-first-input-lse').fill('12000');
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).click();
  await expect(isolatedPage.getByText('Change your delegate')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();

  await performAction(isolatedPage, 'Change Position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(isolatedPage.getByText("You've unstaked 12,000 SKY to exit your position.")).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
});

test('Batch - Lock SKY, select rewards, select delegate, and open position', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Stake' }).click();

  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // fill seal and borrow inputs and click next
  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('38000');

  // // TODO: check all the params
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // select delegate
  await expect(isolatedPage.getByText('Choose your delegate')).toBeVisible();
  await isolatedPage
    .getByTestId(/^delegate-card-/)
    .first()
    .click(); // select the first delegate using data-testid
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // position summary
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible({ timeout: 10000 });
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking').first()).toBeVisible();
  await expect(isolatedPage.getByText('2.4M SKY')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Borrowing')).toBeVisible();
  await expect(isolatedPage.getByText('38K USDS')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();

  // confirm position
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible();
  await expect(
    isolatedPage.getByText("You've borrowed 38,000 USDS by staking 2,400,000 SKY. Your new position is open.")
  ).toBeVisible();
});
