import { Page } from '@playwright/test';
import { Action, approveOrPerformAction } from './approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from './connectMockWalletAndAcceptTerms';

export const withdrawAllAndReset = async (page: Page, buttonText: Action = 'Withdraw') => {
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('widget-navigation').getByRole('link', { name: 'Rewards' }).click();
  const firstFeaturedReward = page.getByText('With: USDS Get: SKY').first();
  if (await firstFeaturedReward.isVisible()) {
    await firstFeaturedReward.click();
  }
  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await page.getByRole('button', { name: '100%' }).click();
  await approveOrPerformAction(page, buttonText);
  await page.getByRole('button', { name: 'Back to Rewards' }).click();
};
