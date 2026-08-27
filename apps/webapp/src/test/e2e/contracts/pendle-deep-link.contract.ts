import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Deep-link contracts for /earn/fixed routes (QA §2 A-4, A-5). */
export const pendleDeepLinkContract: TestContract = {
  id: 'pendle-deep-link',
  qaCase: 'A-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['2653:74409']
  },
  intent: 'Public slug and legacy address routes resolve to the correct market detail page',
  preconditions: ['none'],
  steps: [
    { action: 'goto /earn/fixed/:slug', locator: { testId: 'product-detail' } },
    { action: 'legacy /earn/fixed/market/:address redirects to slug', locator: { testId: 'product-detail' } }
  ],
  oracle: 'Known slug mounts detail; legacy address 302s to slug; unknown slug redirects to /earn'
};
