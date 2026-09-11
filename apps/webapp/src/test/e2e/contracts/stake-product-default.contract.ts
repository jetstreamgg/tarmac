import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Stake destination shell (QA §2 A-10, E-5). */
export const stakeProductDefaultContract: TestContract = {
  id: 'stake-product-default',
  qaCase: 'A-10',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:208698', '1036:208665']
  },
  intent: 'Stake product page renders tabs, engine card, and empty positions entry',
  preconditions: ['connected wallet (fresh vnet account)'],
  steps: [
    { action: 'deep-link /stake', locator: { testId: 'stake-product-page' } },
    { action: 'tabs', locator: { testId: 'stake-tabs' } },
    { action: 'positions tab', locator: { testId: 'stake-tab-positions' } },
    { action: 'open CTA', locator: { testId: 'stake-open-position-cta' } }
  ],
  oracle: 'stake-tabs visible; empty positions state + open-position CTA on Positions tab'
};
