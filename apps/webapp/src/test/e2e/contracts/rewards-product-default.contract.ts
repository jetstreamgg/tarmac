import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Rewards product detail shell (QA §2 A-1). */
export const rewardsProductDefaultContract: TestContract = {
  id: 'rewards-product-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:201228']
  },
  intent: 'Per-farm rewards detail page renders chart and transactions at /earn/rewards/:contract',
  preconditions: ['connected wallet (pool account)', 'valid reward contract on chain'],
  steps: [
    { action: 'goto /earn/rewards/:contract', locator: { testId: 'rewards-supply-card' } },
    { action: 'detail chart', locator: { testId: 'rewards-detail-chart' } },
    { action: 'transactions table', locator: { testId: 'rewards-transactions' } }
  ],
  oracle: 'rewards-detail-chart and rewards-transactions visible; supply or position card mounts'
};
