import { SKY_APP_UI_FILE, type TestContract } from './types';

/** L2 origin token selection inside the savings modal (QA §2 C-1). */
export const savingsL2OriginContract: TestContract = {
  id: 'savings-l2-origin',
  qaCase: 'C-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:35902', '859:35967']
  },
  intent: 'L2 user supplies and withdraws via USDS and USDC origin tokens',
  preconditions: ['connected wallet on L2 (Base/Arbitrum/Optimism/Unichain)', 'USDS and USDC balances'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'savings-supply-cta' } },
    { action: 'select USDC origin', locator: { testId: 'savings-origin-usdc' } },
    { action: 'enter amount', locator: { testId: 'savings-modal-amount-input' } }
  ],
  oracle: 'Supply and withdraw complete for both USDS and USDC origins without legacy token menu'
};
