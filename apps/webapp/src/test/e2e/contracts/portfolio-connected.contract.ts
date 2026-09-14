import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Connected portfolio shell (QA §2 A-2, A-3). */
export const portfolioConnectedContract: TestContract = {
  id: 'portfolio-connected',
  qaCase: 'A-2',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:189460', '1036:189696']
  },
  intent: 'Connected wallet sees earnings card and can toggle Supplied/Idle tabs',
  preconditions: ['connected wallet (pool account)'],
  steps: [
    { action: 'goto /portfolio', locator: { testId: 'portfolio-page' } },
    { action: 'earnings card', locator: { testId: 'stablecoin-earnings-card' } },
    { action: 'switch to Idle tab', locator: { testId: 'portfolio-tab-idle' } }
  ],
  oracle: 'portfolio-page visible; stablecoin-earnings-card mounts; tab switch updates idle/supplied sections'
};
