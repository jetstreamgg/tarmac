import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Savings product page shell — disconnected or connected (QA §2 A-1). */
export const savingsProductDefaultContract: TestContract = {
  id: 'savings-product-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35713', '859:35807']
  },
  intent: 'Savings detail page renders chart, stats and transactions table',
  preconditions: ['connected wallet (pool account)'],
  steps: [
    { action: 'goto /earn/savings', locator: { testId: 'savings-supply-card' } },
    { action: 'detail chart', locator: { testId: 'savings-detail-chart' } },
    { action: 'transactions table', locator: { testId: 'savings-transactions' } }
  ],
  oracle: 'savings-detail-chart and savings-transactions visible; supply or position card mounts'
};
