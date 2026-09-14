import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Open-position takeover write flow (QA §2 B-9). */
export const stakeOpenFlowContract: TestContract = {
  id: 'stake-open-flow',
  qaCase: 'B-9',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:209698', '1036:207162']
  },
  intent: 'User opens a stake position through the takeover (stake, optional borrow, optional delegate)',
  preconditions: ['connected wallet', 'flow=open or CTA path'],
  steps: [
    { action: 'stake amount', locator: { testId: 'stake-takeover-stake-amount' } },
    { action: 'confirm', locator: { testId: 'stake-takeover-confirm' } }
  ],
  oracle: 'Transaction completes; urn visible via flow=manage on-chain reads'
};
