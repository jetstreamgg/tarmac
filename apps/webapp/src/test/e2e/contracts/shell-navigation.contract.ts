import { SKY_APP_UI_FILE, type TestContract } from './types';

/** TopNav destination nav + mainnet auto-switch (QA §2 E-1, A-3). */
export const shellNavigationContract: TestContract = {
  id: 'shell-navigation',
  qaCase: 'E-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['5010:29059', '1030:138558']
  },
  intent:
    'Navigate to a mainnet-only destination from an L2 wallet; app switches network and explains via toast',
  preconditions: ['connected wallet on Tenderly Base', 'clean toast state'],
  steps: [
    { action: 'click Stake in TopNav', locator: { testId: 'nav-stake' } },
    { action: 'assert auto-switch toast', locator: { role: { type: 'button' } } }
  ],
  oracle: 'URL contains network=tenderlymainnet; explanatory toast visible; stake-network selector mounted'
};
