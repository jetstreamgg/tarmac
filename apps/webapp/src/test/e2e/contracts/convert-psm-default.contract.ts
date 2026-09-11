import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Convert PSM page shell (QA §2 A-1). */
export const convertPsmDefaultContract: TestContract = {
  id: 'convert-psm-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:205437', '1036:205471']
  },
  intent: 'PSM convert page renders swap card with from/to inputs and network selector',
  preconditions: ['connected wallet'],
  steps: [
    { action: 'goto /convert', locator: { testId: 'convert-page' } },
    { action: 'convert card', locator: { testId: 'convert-card' } },
    { action: 'from amount', locator: { testId: 'convert-from-amount' } },
    { action: 'review cta', locator: { testId: 'convert-review-cta' } }
  ],
  oracle: 'convert-page visible; default USDS→USDC direction; Review disabled until amount entered'
};
