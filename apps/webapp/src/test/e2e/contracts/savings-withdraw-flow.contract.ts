import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Withdraw modal — form, review, confirm (QA §2 B-4). */
export const savingsWithdrawFlowContract: TestContract = {
  id: 'savings-withdraw-flow',
  qaCase: 'B-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35967', '859:36319', '859:36377']
  },
  intent: 'User withdraws USDS from an existing savings position',
  preconditions: ['connected wallet with sUSDS position', 'on /earn/savings'],
  steps: [
    { action: 'open withdraw modal', locator: { testId: 'savings-position-withdraw' } },
    { action: 'enter amount', locator: { testId: 'savings-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; position balance decreases on-chain'
};
