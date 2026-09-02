import { SKY_APP_UI_FILE, type TestContract } from './types';

/** stUSDS supply modal flow (QA §2 B-3). */
export const stusdsSupplyFlowContract: TestContract = {
  id: 'stusds-supply-flow',
  qaCase: 'B-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:38102', '859:38550']
  },
  intent: 'User validates supply amount in the stUSDS expert-risk modal',
  preconditions: ['connected wallet with USDS', 'on /earn/stusds'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'stusds-supply-cta' } },
    { action: 'enter amount', locator: { testId: 'stusds-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } }
  ],
  oracle: 'Transaction completed successfully; stUSDS position increases on-chain'
};
