import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Morpho vault supply modal flow (QA §2 B-3). */
export const vaultSupplyFlowContract: TestContract = {
  id: 'vault-supply-flow',
  qaCase: 'B-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:38102', '859:38550', '859:38611']
  },
  intent: 'User supplies vault asset through the vault modal',
  preconditions: ['connected wallet with asset balance', 'on morpho vault detail page'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'vault-supply-cta' } },
    { action: 'enter amount', locator: { testId: 'vault-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; position card visible; on-chain vault shares increase'
};
