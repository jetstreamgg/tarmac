import { SKY_APP_UI_FILE, type TestContract } from './types';

/** PSM conversion write flow (QA §2 B-1). */
export const convertPsmFlowContract: TestContract = {
  id: 'convert-psm-flow',
  qaCase: 'B-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:205506', '1036:205561']
  },
  intent: 'User converts USDS↔USDC through review modal and on-chain PSM',
  preconditions: ['connected wallet with origin-token balance', 'on /convert'],
  steps: [
    { action: 'enter amount', locator: { testId: 'convert-from-amount' } },
    { action: 'review', locator: { testId: 'convert-review-cta' } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; origin balance decreases and target increases on-chain'
};
