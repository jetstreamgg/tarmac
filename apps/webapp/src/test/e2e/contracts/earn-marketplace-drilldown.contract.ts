import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Marketplace row drill-down (QA §2 A-7). */
export const earnMarketplaceDrilldownContract: TestContract = {
  id: 'earn-marketplace-drilldown',
  qaCase: 'A-7',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:201228', '1598:77307']
  },
  intent: 'Clicking a savings row navigates to /earn/savings product detail',
  preconditions: ['connected wallet on mainnet fork', 'marketplace loaded'],
  steps: [
    { action: 'click savings row', locator: { testId: 'earn-row-savings' } },
    { action: 'product detail mounts', locator: { testId: 'product-detail' } }
  ],
  oracle: 'URL /earn/savings; product-detail visible'
};
