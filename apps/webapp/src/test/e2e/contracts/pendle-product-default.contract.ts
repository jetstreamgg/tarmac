import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Pendle fixed-yield product detail shell (QA §2 A-1). */
export const pendleProductDefaultContract: TestContract = {
  id: 'pendle-product-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['2653:74409', '2653:79858']
  },
  intent: 'Pendle market detail page renders chart, maturity and transactions at /earn/fixed/:slug',
  preconditions: ['connected wallet', 'known non-matured market slug'],
  steps: [
    { action: 'goto /earn/fixed/pt-susds', locator: { testId: 'product-detail' } },
    { action: 'detail chart', locator: { testId: 'pendle-detail-chart' } },
    { action: 'transactions table', locator: { testId: 'pendle-transactions' } },
    { action: 'supply card', locator: { testId: 'pendle-supply-card' } }
  ],
  oracle: 'product-detail visible; pendle-detail-chart and pendle-transactions mount'
};
