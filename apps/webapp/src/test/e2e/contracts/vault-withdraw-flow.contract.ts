import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Morpho vault withdraw modal flow (QA §2 B-4). */
export const vaultWithdrawFlowContract: TestContract = {
  id: 'vault-withdraw-flow',
  qaCase: 'B-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:38294', '859:38231', '859:38634']
  },
  intent: 'User withdraws from an existing Morpho vault position',
  preconditions: ['connected wallet with vault shares', 'on morpho vault detail page'],
  steps: [
    { action: 'open withdraw modal', locator: { testId: 'vault-position-withdraw' } },
    { action: 'enter amount', locator: { testId: 'vault-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; on-chain vault shares decrease'
};
