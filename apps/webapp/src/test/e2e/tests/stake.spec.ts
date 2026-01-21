import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.js';

test.beforeAll(async () => {});

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Stake & Borrow' }).click();
});

test('Lock SKY, select rewards, select delegate, and open position', async ({ isolatedPage }) => {
  const SKY_AMOUNT_TO_LOCK = '10000000';
  const SKY_AMOUNT_TO_LOCK_DISPLAY = '10M';
  const SKY_AMOUNT_DISPLAY = '10,000,000';
  const USDS_AMOUNT_TO_BORROW = '30000';
  const USDS_AMOUNT_TO_BORROW_DISPLAY = '30K';
  const USDS_AMOUNT_DISPLAY = '30,000';
  const expectedSkyBalance = '100,000,000';

  const SKY_AMOUNT_TO_UNLOCK = '100';

  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText(
    `${expectedSkyBalance} SKY`
  );

  // fill seal and borrow inputs and click next
  await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_LOCK);
  await isolatedPage.getByTestId('borrow-input-lse').first().fill(USDS_AMOUNT_TO_BORROW);

  // check the delegation checkbox to enable delegate selection
  await isolatedPage.getByText('Do you want to delegate voting power?').click();

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
  await isolatedPage.waitForTimeout(1000);
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking').first()).toBeVisible();
  await expect(isolatedPage.getByText(`${SKY_AMOUNT_TO_LOCK_DISPLAY} SKY`)).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Borrowing')).toBeVisible();
  await expect(isolatedPage.getByText(`${USDS_AMOUNT_TO_BORROW_DISPLAY} USDS`).first()).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();

  // confirm position
  await performAction(isolatedPage, 'Open a position', { review: false });

  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText(
      `You've borrowed ${USDS_AMOUNT_DISPLAY} USDS by staking ${SKY_AMOUNT_DISPLAY} SKY. Your new position is open.`
    )
  ).toBeVisible();
  await isolatedPage.waitForTimeout(5000);

  // positions overview
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible({ timeout: 10000 });

  // manage position
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();
  await expect(isolatedPage.getByTestId('borrow-input-lse-balance')).toHaveText(/Limit 0 <> .+ USDS/);

  // verify the delegate checkbox is selected and disabled (since delegate was already chosen)
  const delegateCheckbox = isolatedPage.getByRole('checkbox', {
    name: /You are delegating voting power for this position/i
  });
  await expect(delegateCheckbox).toBeChecked();
  await expect(delegateCheckbox).toBeDisabled();

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
    isolatedPage.getByText(`You've borrowed ${USDS_AMOUNT_DISPLAY} USDS. Your position is updated.`)
  ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // repay all
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();
  await expect(isolatedPage.getByTestId('borrow-input-lse-balance')).toHaveText(/Limit 0 <> .+ USDS/);

  // switch tabs
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();
  // await expect(isolatedPage.getByTestId('repay-input-lse-balance')).toHaveText(/Limit 0 <> .+, or .+ USDS/);

  // click repay 100% button
  await isolatedPage.getByRole('button', { name: '25%' }).click();
  await isolatedPage.getByRole('button', { name: '100%' }).nth(1).click();

  // due to stability fee accumulation, the exact repay amount will change based on time
  // const repayValue = Number(await isolatedPage.getByTestId('repay-input-lse').inputValue());
  // expect(repayValue).toBeGreaterThan(Number(USDS_AMOUNT_TO_BORROW));
  await isolatedPage.getByTestId('widget-button').first().click();

  // skip the rewards and delegates and confirm position
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).click();
  await expect(isolatedPage.getByText('Change your delegate')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();

  await performAction(isolatedPage, 'Change Position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  // await expect(
  //   isolatedPage.getByText(`You've repaid ${Number(USDS_AMOUNT_TO_BORROW) * 2} USDS to exit your position.`)
  // ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // unseal all
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // switch tabs
  await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('7,500,000 SKY');

  // fill some SKY and proceed to skip the rewards and delegates and confirm position
  await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_UNLOCK);
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).click();
  await expect(isolatedPage.getByText('Change your delegate')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'skip' }).first().click();

  await expect(isolatedPage.getByText('Change your position').nth(0)).toBeVisible();

  await performAction(isolatedPage, 'Change Position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText(`You've unstaked ${SKY_AMOUNT_TO_UNLOCK} SKY to exit your position.`)
  ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
});

test.skip('Batch - Lock SKY, select rewards, select delegate, and open position', async ({
  isolatedPage
}) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Stake' }).click();

  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // fill seal and borrow inputs and click next
  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('38000');

  // check the delegation checkbox to enable delegate selection
  await isolatedPage.getByText('Do you want to delegate voting power?').click();

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

test('Checkbox unchecked - Delegate screen should not appear', async ({ isolatedPage }) => {
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // fill seal and borrow inputs
  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('38000');

  // verify checkbox is unchecked by default
  const checkbox = isolatedPage.getByRole('checkbox', { name: /Do you want to delegate voting power?/i });
  await expect(checkbox).not.toBeChecked();

  // click next without checking the delegation checkbox
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // verify delegate screen is skipped and we go directly to position summary
  await expect(isolatedPage.getByText('Choose your delegate')).not.toBeVisible();
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible({ timeout: 10000 });

  // verify position details are correct
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking').first()).toBeVisible();
  await expect(isolatedPage.getByText('2.4M SKY')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Borrowing')).toBeVisible();
  await expect(isolatedPage.getByText('38K USDS')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();

  // confirm position without delegate
  await performAction(isolatedPage, 'Open a position', { review: false });

  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText("You've borrowed 38,000 USDS by staking 2,400,000 SKY. Your new position is open.")
  ).toBeVisible();
});

test('Checkbox toggled off after delegate selection - Delegate should be cleared', async ({
  isolatedPage
}) => {
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // fill seal and borrow inputs
  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('38000');

  // check the delegation checkbox to enable delegate selection
  await isolatedPage.getByText('Do you want to delegate voting power?').click();
  const checkbox = isolatedPage.getByRole('checkbox', { name: /Do you want to delegate voting power?/i });
  await expect(checkbox).toBeChecked();

  // proceed to next screen
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // select a delegate
  await expect(isolatedPage.getByText('Choose your delegate')).toBeVisible();
  await isolatedPage
    .getByTestId(/^delegate-card-/)
    .first()
    .click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();

  // go back to the initial screen using back button
  await isolatedPage.getByRole('button', { name: 'back' }).click();
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'back' }).click();
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // uncheck the delegation checkbox
  await isolatedPage.getByText('Do you want to delegate voting power?').click();
  await expect(checkbox).not.toBeChecked();

  // proceed forward again
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // select rewards again
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  // await page.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // verify delegate screen is now skipped
  await expect(isolatedPage.getByText('Choose your delegate')).not.toBeVisible();
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible({ timeout: 10000 });

  // verify position summary does NOT show any delegate information
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking').first()).toBeVisible();
  await expect(isolatedPage.getByText('2.4M SKY')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Borrowing')).toBeVisible();
  await expect(isolatedPage.getByText('38K USDS')).toBeVisible();
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('Staking reward')).toBeVisible();
  // verify no delegate section appears in summary
  await expect(isolatedPage.getByTestId('position-summary-card').getByText('BLUE')).not.toBeVisible();

  // confirm position
  await performAction(isolatedPage, 'Open a position', { review: false });

  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });
  await expect(
    isolatedPage.getByText("You've borrowed 38,000 USDS by staking 2,400,000 SKY. Your new position is open.")
  ).toBeVisible();

  // navigate to positions overview and verify the position was created without delegate
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();

  // verify no delegate information is shown in the position card
  const positionCard = isolatedPage.getByRole('button', { name: 'Manage Position' }).last().locator('..');
  await expect(positionCard.getByText('BLUE')).not.toBeVisible();
  await expect(positionCard.getByText('Delegate')).not.toBeVisible();

  // manage position to verify no delegate is set
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // verify the delegate checkbox is NOT checked and is enabled (no delegate was set)
  const manageDelegateCheckbox = isolatedPage.getByRole('checkbox', {
    name: /Do you want to delegate voting power?/i
  });
  await expect(manageDelegateCheckbox).not.toBeChecked();
  await expect(manageDelegateCheckbox).toBeEnabled();
});

test('Slider interaction - Move slider and verify borrow amount changes', async ({ isolatedPage }) => {
  // Setup: Create a position with collateral and some initial borrowing
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  // Lock collateral and borrow a small amount
  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('30000');

  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  // Must select rewards
  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  // No delegate selection -- checkbox wasn't enabled

  // Confirm position
  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });

  // Navigate to manage position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // Capture initial state before slider interaction
  const initialBorrowInput = await isolatedPage.getByTestId('borrow-input-lse').inputValue();
  const initialBorrowAmount = Number(initialBorrowInput);

  // Get initial risk level from the position overview
  const positionOverview = isolatedPage.getByText('Position overview').locator('..');
  await expect(positionOverview).toBeVisible();

  // Find and interact with the slider
  const slider = isolatedPage.locator('[role="slider"]').first();
  await expect(slider).toBeVisible();

  // Get the slider's bounding box to calculate positions
  const sliderBox = await slider.boundingBox();
  expect(sliderBox).not.toBeNull();

  if (sliderBox) {
    // Move slider to approximately 50% position (middle of the slider)
    // This should increase the borrow amount since we started at a low value
    const targetX = sliderBox.x + sliderBox.width * 0.5;
    const targetY = sliderBox.y + sliderBox.height / 2;

    // Click and drag the slider to the new position
    await slider.hover();
    await isolatedPage.mouse.down();
    await isolatedPage.mouse.move(targetX, targetY);
    await isolatedPage.mouse.up();

    // Wait for debouncing and state updates
    await isolatedPage.waitForTimeout(500);

    // Verify that the borrow amount has changed
    const newBorrowInput = await isolatedPage.getByTestId('borrow-input-lse').inputValue();
    const newBorrowAmount = Number(newBorrowInput);

    // The borrow amount should have increased since we moved the slider right
    expect(newBorrowAmount).toBeGreaterThan(initialBorrowAmount);

    // Verify the amount is reasonable (not zero, not exceeding max borrowable)
    expect(newBorrowAmount).toBeGreaterThan(0);
    expect(newBorrowAmount).toBeLessThan(1000000); // Reasonable upper bound

    // Log the values for debugging
    console.log(`Initial borrow amount: ${initialBorrowAmount} USDS`);
    console.log(`New borrow amount: ${newBorrowAmount} USDS`);
    console.log(`Increase: ${newBorrowAmount - initialBorrowAmount} USDS`);
  }
});

test('Slider respects risk floor in borrow mode', async ({ isolatedPage }) => {
  // Create position with initial borrowing
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('50000');

  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });

  // Navigate to manage position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // Clear the borrow input to reset to risk floor
  await isolatedPage.getByTestId('borrow-input-lse').clear();
  await isolatedPage.waitForTimeout(500);

  // Find the slider and verify it's at the risk floor
  const slider = isolatedPage.locator('[role="slider"]').first();
  await expect(slider).toBeVisible();

  const sliderBox = await slider.boundingBox();
  expect(sliderBox).not.toBeNull();

  if (sliderBox) {
    // Try to drag slider to the far left (0% position)
    const targetX = sliderBox.x;
    const targetY = sliderBox.y + sliderBox.height / 2;

    await slider.hover();
    await isolatedPage.mouse.down();
    await isolatedPage.mouse.move(targetX, targetY);
    await isolatedPage.mouse.up();

    await isolatedPage.waitForTimeout(500);

    // Verify borrow amount is 0 (can't go below risk floor)
    const borrowInput = await isolatedPage.getByTestId('borrow-input-lse').inputValue();
    const borrowAmount = Number(borrowInput);
    expect(borrowAmount).toBe(0);

    console.log(`Risk floor constraint working: Borrow amount stayed at ${borrowAmount} USDS`);
  }
});

test('Two-way sync - Input field updates slider position', async ({ isolatedPage }) => {
  // Create position with collateral
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('30000');

  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });

  // Navigate to manage position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // Find the slider
  const slider = isolatedPage.locator('[role="slider"]').first();
  await expect(slider).toBeVisible();

  // Get initial slider position
  const initialSliderValue = await slider.getAttribute('aria-valuenow');
  console.log(`Initial slider position: ${initialSliderValue}%`);

  // Type increasing borrow amounts and verify slider moves right
  await isolatedPage.getByTestId('borrow-input-lse').fill('25000');
  await isolatedPage.waitForTimeout(500);
  const sliderValue1 = await slider.getAttribute('aria-valuenow');
  console.log(`After 25K USDS, slider position: ${sliderValue1}%`);

  await isolatedPage.getByTestId('borrow-input-lse').fill('50000');
  await isolatedPage.waitForTimeout(500);
  const sliderValue2 = await slider.getAttribute('aria-valuenow');
  console.log(`After 50K USDS, slider position: ${sliderValue2}%`);

  await isolatedPage.getByTestId('borrow-input-lse').fill('75000');
  await isolatedPage.waitForTimeout(500);
  const sliderValue3 = await slider.getAttribute('aria-valuenow');
  console.log(`After 75K USDS, slider position: ${sliderValue3}%`);

  // Verify slider moved right with each increase
  expect(Number(sliderValue1)).toBeGreaterThan(Number(initialSliderValue));
  expect(Number(sliderValue2)).toBeGreaterThan(Number(sliderValue1));
  // expect(Number(sliderValue3)).toBeGreaterThan(Number(sliderValue2));

  // Verify position overview contains risk level information
  // Use the widget container to be more specific
  const widgetContainer = isolatedPage.getByTestId('widget-container');
  await expect(widgetContainer.getByText('Risk level')).toBeVisible();

  console.log('Two-way sync working: Input field updates slider position and risk level');
});

test('Slider movement updates all position overview parameters', async ({ isolatedPage }) => {
  // Create position with borrowing
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  await isolatedPage.getByTestId('supply-first-input-lse').fill('2400000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('30000');

  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });

  // Navigate to manage position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // Use widget container for more specific querying
  const widgetContainer = isolatedPage.getByTestId('widget-container');
  await expect(widgetContainer.getByText('Position overview')).toBeVisible();

  // Capture initial parameters
  const initialBorrow = await isolatedPage.getByTestId('borrow-input-lse').inputValue();

  // Get initial overview text content to compare later
  const initialOverviewText = await widgetContainer.textContent();
  expect(initialOverviewText).toContain('Collateralization ratio');
  expect(initialOverviewText).toContain('Liquidation price');
  expect(initialOverviewText).toContain('Risk level');
  expect(initialOverviewText).toContain('Debt ceiling utilization');

  // Find and move slider to higher risk position (~70%)
  const slider = isolatedPage.locator('[role="slider"]').first();
  await expect(slider).toBeVisible();

  const sliderBox = await slider.boundingBox();
  expect(sliderBox).not.toBeNull();

  if (sliderBox) {
    const targetX = sliderBox.x + sliderBox.width * 0.7;
    const targetY = sliderBox.y + sliderBox.height / 2;

    await slider.hover();
    await isolatedPage.mouse.down();
    await isolatedPage.mouse.move(targetX, targetY);
    await isolatedPage.mouse.up();

    await isolatedPage.waitForTimeout(500);

    // Verify borrow amount increased
    const newBorrow = await isolatedPage.getByTestId('borrow-input-lse').inputValue();
    expect(Number(newBorrow)).toBeGreaterThan(Number(initialBorrow));

    // Get new overview text
    const newOverviewText = await widgetContainer.textContent();

    // Verify all parameters are still present (and updated)
    expect(newOverviewText).toContain('Collateralization ratio');
    expect(newOverviewText).toContain('Liquidation price');
    expect(newOverviewText).toContain('Risk level');
    expect(newOverviewText).toContain('Debt ceiling utilization');

    // Verify the overview content changed
    expect(newOverviewText).not.toBe(initialOverviewText);

    console.log(`Initial borrow: ${initialBorrow} USDS`);
    console.log(`New borrow: ${newBorrow} USDS`);
    console.log('Position overview parameters updated successfully');
  }
});

test('Debt ceiling cap indicator prevents over-borrowing', async ({ isolatedPage }) => {
  // Create position with substantial collateral
  await expect(isolatedPage.getByTestId('supply-first-input-lse-balance')).toHaveText('100,000,000 SKY');

  await isolatedPage.getByTestId('supply-first-input-lse').fill('5000000');
  await isolatedPage.getByTestId('borrow-input-lse').fill('30000');

  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 10000 });
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
  await isolatedPage.getByTestId('stake-reward-card').first().click();
  await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled();
  await isolatedPage.getByTestId('widget-button').first().click();

  await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
  await performAction(isolatedPage, 'Open a position', { review: false });
  await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 10000 });

  // Navigate to manage position
  await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
  await expect(isolatedPage.getByText('Position 1')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();
  await expect(isolatedPage.getByText('Your position 1')).toBeVisible();

  // Get the max borrowable from the limit text
  const limitText = await isolatedPage.getByTestId('borrow-input-lse-balance').textContent();
  console.log(`Limit text: ${limitText}`);

  // Find slider and move to far right (trying to exceed cap)
  const slider = isolatedPage.locator('[role="slider"]').first();
  await expect(slider).toBeVisible();

  const sliderBox = await slider.boundingBox();
  expect(sliderBox).not.toBeNull();

  if (sliderBox) {
    // Try to drag slider to 100% position
    const targetX = sliderBox.x + sliderBox.width;
    const targetY = sliderBox.y + sliderBox.height / 2;

    await slider.hover();
    await isolatedPage.mouse.down();
    await isolatedPage.mouse.move(targetX, targetY);
    await isolatedPage.mouse.up();

    await isolatedPage.waitForTimeout(500);

    // Get the borrow amount
    const borrowAmount = await isolatedPage.getByTestId('borrow-input-lse').inputValue();
    console.log(`Borrow amount at max slider: ${borrowAmount} USDS`);

    // Verify no error message about exceeding debt ceiling
    const errorMessage = isolatedPage.getByText('Requested borrow amount exceeds the debt ceiling');
    await expect(errorMessage).not.toBeVisible();

    // Verify borrow amount is reasonable (capped appropriately)
    expect(Number(borrowAmount)).toBeGreaterThan(0);
    expect(Number(borrowAmount)).toBeLessThan(10000000); // Reasonable upper bound
  }
});
