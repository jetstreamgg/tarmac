import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Token URL filter on marketplace (QA §2 A-2). */
export const earnMarketplaceFilterContract: TestContract = {
  id: 'earn-marketplace-filter',
  qaCase: 'A-2',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:201582']
  },
  intent: 'Deep link /earn?token=USDC pre-filters the opportunities table',
  preconditions: ['marketplace loaded'],
  steps: [
    { action: 'goto filtered earn', locator: { testId: 'earn-opportunities' } },
    { action: 'clear filters when rows hidden', locator: { testId: 'earn-clear-filters' } }
  ],
  oracle: 'earn-clear-filters visible with a non-zero hidden count when filter excludes rows'
};
