import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Morpho vault product detail shell (QA §2 A-1). */
export const vaultProductDefaultContract: TestContract = {
  id: 'vault-product-default',
  qaCase: 'A-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['859:37888', '859:37980']
  },
  intent: 'Morpho vault detail page renders chart, strategy and transactions',
  preconditions: ['connected wallet', 'valid vault on active chain'],
  steps: [
    { action: 'goto /earn/vaults/morpho/:address', locator: { testId: 'vault-supply-card' } },
    { action: 'detail chart', locator: { testId: 'vault-detail-chart' } },
    { action: 'strategy section', locator: { testId: 'vault-strategy' } },
    { action: 'transactions table', locator: { testId: 'vault-transactions' } }
  ],
  oracle: 'vault-detail-chart, vault-strategy, vault-transactions visible; supply or position card mounts'
};
