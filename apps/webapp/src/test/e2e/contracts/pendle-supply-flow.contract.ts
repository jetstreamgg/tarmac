import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Pendle buy modal flow (QA §2 B-3) — write path deferred pending quote API on vnet. */
export const pendleSupplyFlowContract: TestContract = {
  id: 'pendle-supply-flow',
  qaCase: 'B-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['2653:79974', '2653:74768', '2653:80163']
  },
  intent: 'User buys PT through the Pendle supply modal with slippage controls',
  preconditions: ['connected wallet', 'Pendle quote API reachable', 'on /earn/fixed/:slug'],
  steps: [
    { action: 'open supply modal', locator: { testId: 'pendle-supply-cta' } },
    { action: 'enter amount', locator: { testId: 'pendle-modal-amount-input' } },
    { action: 'review', locator: { role: { type: 'button', name: 'Review' } } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } }
  ],
  oracle: 'Transaction completed successfully; PT balance increases on-chain'
};
