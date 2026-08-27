import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Wallet preview drawer network switch (QA §2 C-3). */
export const shellWalletDrawerContract: TestContract = {
  id: 'shell-wallet-drawer',
  qaCase: 'C-3',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1030:138710', '1030:138802']
  },
  intent: 'User switches chain from the wallet preview drawer; URL and selector label update',
  preconditions: ['connected wallet', 'drawer closed'],
  steps: [
    { action: 'open wallet chip', locator: { testId: 'wallet-chip' } },
    { action: 'open network selector', locator: { testId: 'wallet-drawer-network' } },
    { action: 'pick Tenderly Base', locator: { role: { type: 'button', name: 'Tenderly Base' } } }
  ],
  oracle: 'URL network=tenderlybase; drawer network label reads Tenderly Base after reopen'
};
