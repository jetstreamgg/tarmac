import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Rewards withdraw modal (QA §2 B-4). */
export const rewardsWithdrawFlowContract: TestContract = {
  id: 'rewards-withdraw-flow',
  qaCase: 'B-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35967', '859:36319']
  },
  intent: 'User withdraws USDS from an existing reward-farm position',
  preconditions: ['connected wallet with staked balance', 'on /earn/rewards/:contract'],
  steps: [
    { action: 'open withdraw modal', locator: { testId: 'rewards-position-withdraw' } },
    { action: 'enter amount', locator: { testId: 'rewards-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; on-chain staked balance decreases'
};
