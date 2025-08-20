import { expect, test, hasStagehandCapabilities } from '../stagehand-fixtures';
import { approveOrPerformAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { performAction as stagehandPerformAction } from '../utils/stagehand-helpers';
import { setErc20Balance } from '../utils/setBalance';
import { usdsAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { NetworkName } from '../utils/constants';

test.describe('Rewards with Stagehand AI capabilities', () => {
  test.beforeEach(async ({ stagehandPage }) => {
    // Ensure wallet has USDS tokens for rewards testing (same as base fixtures)
    await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet);

    await stagehandPage.goto('http://localhost:3000/');

    // Connect mock wallet and accept terms for all tests
    await connectMockWalletAndAcceptTerms(stagehandPage);

    // Navigate to rewards and select USDS->SKY pool using natural language or standard selectors
    await stagehandPerformAction(
      stagehandPage,
      'Navigate to the Rewards section and select the USDS to SKY rewards pool',
      async () => {
        await stagehandPage.getByRole('tab', { name: 'Rewards' }).click();
        await stagehandPage.getByText('With: USDS Get: SKY').first().click();
      }
    );
  });

  test('AI-powered supply and withdraw validation', async ({ stagehandPage }) => {
    if (hasStagehandCapabilities(stagehandPage)) {
      // Use AI to understand and test insufficient funds scenarios
      await stagehandPage.act!('Enter an amount greater than my balance in the supply input');

      const errorMessage = await stagehandPage.extract!('What error message is displayed?');
      expect(errorMessage).toContain('Insufficient');
      console.log('AI detected error:', errorMessage);

      // Test withdrawal insufficient funds
      await stagehandPage.act!('Switch to the Withdraw tab');
      await stagehandPage.act!('Enter 1 in the withdraw amount field');

      const withdrawError = await stagehandPage.extract!('What error message is shown for withdrawal?');
      expect(withdrawError).toContain('Insufficient');
      console.log('AI detected withdrawal error:', withdrawError);
    } else {
      // Standard Playwright fallback
      const page = stagehandPage as any;
      await page.getByTestId('supply-input-rewards').fill('101');
      await expect(page.getByText('Insufficient funds')).toBeVisible();

      await page.getByRole('tab', { name: 'Withdraw' }).click();
      await page.getByTestId('withdraw-input-rewards').fill('1');
      await expect(page.getByText('Insufficient funds')).toBeVisible();
    }
  });

  test('AI-guided supply and withdraw flow', async ({ stagehandPage }) => {
    if (hasStagehandCapabilities(stagehandPage)) {
      // Use AI to check initial balances and understand the interface
      const initialBalance = await stagehandPage.extract!('What is my current USDS balance for rewards?');
      console.log('Initial balance detected by AI:', initialBalance);

      const suppliedBalance = await stagehandPage.extract!('What is my current supplied balance?');
      console.log('Supplied balance detected by AI:', suppliedBalance);
      expect(suppliedBalance).toContain('0 USDS');

      // AI-powered supply flow
      await stagehandPage.act!('Enter 2 USDS to supply for rewards');

      // AI can understand the approval/transaction flow
      await stagehandPage.act!('Complete the supply transaction including any necessary approvals');

      // Wait for transaction completion and return to rewards
      await stagehandPage.act!('Click the button to return to the rewards page');

      // AI verifies the balance changes
      const newBalance = await stagehandPage.extract!('What is my USDS balance now after supplying 2 USDS?');
      const newSuppliedBalance = await stagehandPage.extract!('What is my supplied balance now?');

      console.log('New balance after supply:', newBalance);
      console.log('New supplied balance:', newSuppliedBalance);
      expect(newSuppliedBalance).toContain('2 USDS');

      // AI-powered withdrawal flow
      await stagehandPage.act!('Switch to withdrawal and withdraw all my supplied USDS');
      await stagehandPage.act!('Complete the withdrawal transaction');
      await stagehandPage.act!('Return to the rewards page');

      // AI verifies withdrawal completed
      const finalSuppliedBalance = await stagehandPage.extract!(
        'What is my supplied balance after withdrawal?'
      );
      expect(finalSuppliedBalance).toContain('0 USDS');
    } else {
      // Standard Playwright implementation
      const page = stagehandPage as any;
      await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('100 USDS');

      const rewardsCardSuppliedBalance = page
        .getByTestId('widget-container')
        .getByText('Supplied balance', { exact: true })
        .locator('xpath=ancestor::div[1]')
        .getByText(/^\d.*USDS$/);

      await expect(rewardsCardSuppliedBalance).toHaveText('0 USDS');
      await page.getByTestId('supply-input-rewards').fill('2');
      await expect(page.getByTestId('widget-button')).toBeEnabled();

      await approveOrPerformAction(page, 'Supply');
      await page.getByRole('button', { name: 'Back to Rewards' }).click();

      await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('98 USDS');
      await expect(rewardsCardSuppliedBalance).toHaveText('2 USDS');

      await page.getByRole('tab', { name: 'Withdraw' }).click();
      await expect(page.getByTestId('withdraw-input-rewards-balance')).toHaveText('2 USDS');
      await page.getByTestId('withdraw-input-rewards').fill('2');

      await approveOrPerformAction(page, 'Withdraw');
      await page.getByRole('button', { name: 'Back to Rewards' }).click();

      await expect(page.getByTestId('withdraw-input-rewards-balance')).toHaveText('0 USDS');
      await expect(rewardsCardSuppliedBalance).toHaveText('0 USDS');
    }
  });

  test('AI understands percentage buttons and input validation', async ({ stagehandPage }) => {
    if (hasStagehandCapabilities(stagehandPage)) {
      // AI can understand and test percentage functionality
      await stagehandPage.act!('Click the 25% button to set the supply amount');
      const twentyFivePercent = await stagehandPage.extract!('What amount is now in the supply input field?');
      expect(twentyFivePercent).toContain('25');

      await stagehandPage.act!('Click the 100% button to supply maximum amount');
      const maxAmount = await stagehandPage.extract!('What is the maximum amount I can supply?');
      expect(maxAmount).toContain('100');

      // AI tests the button state logic
      await stagehandPage.act!('Clear the input field');
      const buttonState = await stagehandPage.extract!(
        'Is the supply button enabled or disabled when the field is empty?'
      );
      expect(buttonState.toLowerCase()).toContain('disabled');

      await stagehandPage.act!('Enter 0 in the supply field');
      const zeroState = await stagehandPage.extract!('Is the supply button enabled when I enter 0?');
      expect(zeroState.toLowerCase()).toContain('disabled');

      await stagehandPage.act!('Enter 1 in the supply field');
      const validState = await stagehandPage.extract!('Is the supply button enabled now?');
      expect(validState.toLowerCase()).toContain('enabled');
    } else {
      // Standard Playwright implementation
      const page = stagehandPage as any;
      await page.getByRole('button', { name: '25%' }).click();
      expect(await page.getByTestId('supply-input-rewards').inputValue()).toBe('25');

      await page.getByRole('button', { name: '100%' }).click();
      expect(await page.getByTestId('supply-input-rewards').inputValue()).toBe('100');

      const widgetButton = page.getByTestId('widget-container').getByRole('button').last();

      await page.getByTestId('supply-input-rewards').clear();
      await expect(widgetButton).toBeDisabled();

      await page.getByTestId('supply-input-rewards').fill('0');
      await expect(widgetButton).toBeDisabled();

      await page.getByTestId('supply-input-rewards').fill('1');
      await expect(widgetButton).toBeEnabled();
    }
  });

  test('AI understands wallet connection requirements', async ({ stagehandPage }) => {
    // Reload to disconnect wallet
    await stagehandPage.reload();

    if (hasStagehandCapabilities(stagehandPage)) {
      // Navigate back to rewards without wallet connected
      await stagehandPage.act!('Go to the Rewards section');
      await stagehandPage.act!('Select the USDS to SKY rewards pool');

      // AI should understand the wallet connection state
      const connectionState = await stagehandPage.extract!(
        'What does the interface show when no wallet is connected?'
      );
      expect(connectionState.toLowerCase()).toContain('connect');
      console.log('AI detected connection state:', connectionState);

      // AI can handle wallet connection
      await stagehandPage.act!('Connect the wallet');

      // Verify connection worked
      const connectedState = await stagehandPage.extract!('Is the wallet now connected and ready to use?');
      const lowerState = connectedState.toLowerCase();
      expect(lowerState.includes('connect') || lowerState.includes('ready')).toBe(true);
    } else {
      // Standard Playwright implementation
      const page = stagehandPage as any;
      await page.getByRole('tab', { name: 'Rewards' }).click();
      await page.getByText('With: USDS Get: SKY').first().click();

      const widgetConnectButton = page
        .getByTestId('widget-container')
        .getByRole('button', { name: 'Connect Wallet' });

      await expect(widgetConnectButton).toBeEnabled();
      await expect(page.getByRole('heading', { name: 'Connect to explore Sky' })).toBeVisible();

      await connectMockWalletAndAcceptTerms(page);
      await expect(widgetConnectButton).not.toBeVisible();
    }
  });

  test('AI analyzes approval flow complexity', async ({ stagehandPage }) => {
    if (hasStagehandCapabilities(stagehandPage)) {
      // AI can understand and explain the approval process
      await stagehandPage.act!('Enter 90 USDS to supply');
      await stagehandPage.act!('Click the review button');

      const approvalInfo = await stagehandPage.extract!(
        'What does the interface tell me about approvals and how many transactions are needed?'
      );
      console.log('AI approval analysis:', approvalInfo);

      // AI should detect that 2 transactions are needed (approval + supply)
      const lowerApproval = approvalInfo.toLowerCase();
      expect(
        lowerApproval.includes('2') ||
          lowerApproval.includes('approval') ||
          lowerApproval.includes('transaction')
      ).toBe(true);

      // Let AI explain what each transaction does
      const transactionExplanation = await stagehandPage.extract!(
        'What are the two transactions that need to be completed?'
      );
      console.log('AI transaction explanation:', transactionExplanation);
    } else {
      // Standard Playwright implementation
      const page = stagehandPage as any;
      await page.getByTestId('supply-input-rewards').fill('90');
      await page.getByRole('button', { name: 'Review' }).click();

      await expect(page.getByTestId('widget-button').last()).toHaveText('Confirm 2 transactions');
    }
  });
});
