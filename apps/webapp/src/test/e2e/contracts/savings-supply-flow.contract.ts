import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Supply modal — form, review, confirm (QA §2 B-1, B-3). */
export const savingsSupplyFlowContract: TestContract = {
  id: 'savings-supply-flow',
  qaCase: 'B-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35902', '859:36152', '859:36258', '859:36235']
  },
  intent: 'User supplies USDS (or DAI via upgrade bundle) through the savings modal',
  preconditions: ['connected wallet with origin-token balance', 'on /earn/savings'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'savings-supply-cta' } },
    { action: 'enter amount', locator: { testId: 'savings-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; position card replaces supply CTA'
};
