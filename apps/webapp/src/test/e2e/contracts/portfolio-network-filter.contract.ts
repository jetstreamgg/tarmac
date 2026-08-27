import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Portfolio header network filter (QA §2 A-4). */
export const portfolioNetworkFilterContract: TestContract = {
  id: 'portfolio-network-filter',
  qaCase: 'A-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:190373']
  },
  intent: 'Connected portfolio exposes the page-level network filter in the header',
  preconditions: ['connected wallet'],
  steps: [
    { action: 'goto /portfolio', locator: { testId: 'portfolio-page' } },
    { action: 'network filter', locator: { testId: 'portfolio-network-filter' } }
  ],
  oracle: 'portfolio-network-filter visible and interactive'
};
