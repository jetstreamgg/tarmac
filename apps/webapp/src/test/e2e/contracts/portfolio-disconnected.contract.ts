import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Disconnected portfolio landing (QA §2 A-1). */
export const portfolioDisconnectedContract: TestContract = {
  id: 'portfolio-disconnected',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:189276']
  },
  intent: 'Visitor sees connect prompt, earn marketplace cards, and Sky statistics on /portfolio',
  preconditions: ['wallet disconnected'],
  steps: [
    { action: 'goto /portfolio', locator: { testId: 'portfolio-page' } },
    { action: 'connect CTA visible', locator: { testId: 'portfolio-connect-card-button' } },
    { action: 'statistics section', locator: { testId: 'portfolio-statistics' } }
  ],
  oracle: 'portfolio-page + portfolio-connect-card-button + portfolio-statistics visible'
};
