import type { Page } from '@playwright/test';
import type { StagehandPage } from '../stagehand-fixtures';
import { hasStagehandCapabilities } from '../stagehand-fixtures';
export { hasStagehandCapabilities } from '../stagehand-fixtures';

/**
 * Stagehand helper utilities for enhanced test automation
 */

/**
 * Performs a natural language action using Stagehand
 * Falls back to standard Playwright if Stagehand is not available
 */
export async function performAction(
  page: Page | StagehandPage,
  action: string,
  fallback?: () => Promise<void>
): Promise<void> {
  if (hasStagehandCapabilities(page)) {
    // Use Stagehand's natural language capabilities
    await page.act!(action);
  } else if (fallback) {
    // Fall back to standard Playwright actions
    await fallback();
  } else {
    throw new Error(`Cannot perform action "${action}": Stagehand is not enabled and no fallback provided`);
  }
}

/**
 * Extracts information from the page using Stagehand
 * Falls back to standard Playwright selectors if Stagehand is not available
 */
export async function extractInfo<T = any>(
  page: Page | StagehandPage,
  instruction: string,
  fallback?: () => Promise<T>
): Promise<T> {
  if (hasStagehandCapabilities(page)) {
    // Use Stagehand's extraction capabilities
    return await page.extract!(instruction);
  } else if (fallback) {
    // Fall back to standard Playwright extraction
    return await fallback();
  } else {
    throw new Error(`Cannot extract "${instruction}": Stagehand is not enabled and no fallback provided`);
  }
}

/**
 * Wrapper for common DeFi actions with Stagehand
 */
export class DeFiActions {
  constructor(private page: Page | StagehandPage) {}

  /**
   * Connects a wallet using natural language or standard selectors
   */
  async connectWallet(walletName: string = 'MetaMask'): Promise<void> {
    await performAction(this.page, `Connect ${walletName} wallet`, async () => {
      // Fallback to standard Playwright actions
      await this.page.getByRole('button', { name: /connect wallet/i }).click();
      await this.page.getByRole('button', { name: new RegExp(walletName, 'i') }).click();
    });
  }

  /**
   * Performs a token swap using natural language
   */
  async swapTokens(fromAmount: string, fromToken: string, toToken: string): Promise<void> {
    await performAction(this.page, `Swap ${fromAmount} ${fromToken} for ${toToken}`, async () => {
      // Fallback to standard Playwright actions
      await this.page.getByTestId('trade-input-origin').fill(fromAmount);
      await this.page.getByRole('button', { name: 'Select token' }).click();
      await this.page.getByRole('button', { name: new RegExp(toToken, 'i') }).click();
      await this.page.getByRole('button', { name: 'Review trade' }).click();
      await this.page.getByRole('button', { name: 'Confirm trade' }).click();
    });
  }

  /**
   * Stakes tokens using natural language
   */
  async stakeTokens(amount: string, token: string): Promise<void> {
    await performAction(this.page, `Stake ${amount} ${token}`, async () => {
      // Fallback implementation would depend on your UI
      await this.page.getByRole('tab', { name: 'Stake' }).click();
      await this.page.getByTestId('stake-input').fill(amount);
      await this.page.getByRole('button', { name: 'Stake' }).click();
    });
  }

  /**
   * Gets wallet balance using natural language extraction
   */
  async getBalance(token: string): Promise<string> {
    return await extractInfo(this.page, `Get the current balance of ${token} token`, async () => {
      // Fallback to standard Playwright extraction
      const balanceElement = await this.page.getByTestId(`balance-${token.toLowerCase()}`);
      return (await balanceElement.textContent()) || '0';
    });
  }

  /**
   * Approves token spending
   */
  async approveToken(token: string, spender?: string): Promise<void> {
    const spenderInfo = spender ? ` for ${spender}` : '';
    await performAction(this.page, `Approve ${token} token spending${spenderInfo}`, async () => {
      await this.page.getByRole('button', { name: `Approve ${token}` }).click();
    });
  }

  /**
   * Claims rewards
   */
  async claimRewards(): Promise<void> {
    await performAction(this.page, 'Claim all available rewards', async () => {
      await this.page.getByRole('tab', { name: 'Rewards' }).click();
      await this.page.getByRole('button', { name: 'Claim' }).click();
    });
  }
}

/**
 * Creates a DeFi actions helper with the given page
 */
export function createDeFiActions(page: Page | StagehandPage): DeFiActions {
  return new DeFiActions(page);
}
