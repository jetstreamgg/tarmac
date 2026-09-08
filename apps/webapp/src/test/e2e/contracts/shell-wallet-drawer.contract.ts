import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Wallet preview drawer (QA §2 C-3). */
export const shellWalletDrawerContract: TestContract = {
  id: 'shell-wallet-drawer',
  qaCase: 'C-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1030:138710', '1030:138802']
  },
  intent: 'User opens the wallet preview drawer from the wallet chip',
  preconditions: ['connected wallet', 'drawer closed'],
  steps: [{ action: 'open wallet chip', locator: { testId: 'wallet-chip' } }],
  oracle: 'wallet-drawer visible; no network control in the drawer header (switching is per product)'
};
