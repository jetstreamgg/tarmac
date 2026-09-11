import { SKY_APP_UI_FILE, type TestContract } from './types';

/** stUSDS product detail shell (QA §2 A-1). */
export const stusdsProductDefaultContract: TestContract = {
  id: 'stusds-product-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:37888']
  },
  intent: 'stUSDS detail page renders chart and transactions at /earn/stusds',
  preconditions: ['connected wallet'],
  steps: [
    { action: 'goto /earn/stusds', locator: { testId: 'product-detail' } },
    { action: 'detail chart', locator: { testId: 'stusds-detail-chart' } },
    { action: 'transactions table', locator: { testId: 'stusds-transactions' } }
  ],
  oracle: 'product-detail visible; stusds-detail-chart and stusds-transactions mount'
};
