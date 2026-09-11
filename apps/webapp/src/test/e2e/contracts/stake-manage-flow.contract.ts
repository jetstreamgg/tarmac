import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Manage sheet write flow (QA §2 C-5). */
export const stakeManageFlowContract: TestContract = {
  id: 'stake-manage-flow',
  qaCase: 'C-5',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:214176', '1036:213821']
  },
  intent: 'User borrows more against an existing position through the manage sheet',
  preconditions: ['existing urn', 'flow=manage&urn_index=N'],
  steps: [
    { action: 'borrow menu', locator: { testId: 'stake-manage-menu-borrow' } },
    { action: 'borrow amount', locator: { testId: 'stake-manage-borrow-amount' } },
    { action: 'confirm', locator: { testId: 'stake-manage-confirm' } }
  ],
  oracle: 'Debt increases on-chain; details modal reflects new borrowed figure'
};
