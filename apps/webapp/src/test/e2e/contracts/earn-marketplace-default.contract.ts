import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Default /earn marketplace mount (QA §2 A-1). */
export const earnMarketplaceDefaultContract: TestContract = {
  id: 'earn-marketplace-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:201228', '1036:201233']
  },
  intent: 'Visitor lands on /earn with featured cards and the opportunities table',
  preconditions: ['wallet optional'],
  steps: [
    { action: 'goto /earn', locator: { testId: 'earn-opportunities' } },
    { action: 'featured cards', locator: { testId: 'earn-featured-cards' } },
    { action: 'opportunities table', locator: { testId: 'earn-opportunities-table' } }
  ],
  oracle: 'earn-opportunities + earn-featured-cards + earn-opportunities-table visible'
};
