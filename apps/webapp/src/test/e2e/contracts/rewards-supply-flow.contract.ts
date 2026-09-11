import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Rewards supply modal — form, review, confirm (QA §2 B-1, B-3). */
export const rewardsSupplyFlowContract: TestContract = {
  id: 'rewards-supply-flow',
  qaCase: 'B-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35902', '859:36152']
  },
  intent: 'User supplies USDS to a reward farm through the rewards modal',
  preconditions: ['connected wallet with USDS balance', 'on /earn/rewards/:contract'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'rewards-supply-cta' } },
    { action: 'enter amount', locator: { testId: 'rewards-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle:
    'Transaction completed successfully; position card replaces supply CTA; on-chain staked balance increases'
};
