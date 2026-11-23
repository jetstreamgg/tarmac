import { SKY_APP_UI_FILE, type TestContract } from './types';

/** What stops an Ethereum → L2 deposit before Review: bad recipients and a closed route. */
export const bridgeNativeBlocksContract: TestContract = {
  id: 'bridge-native-blocks',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['3574:64074', '3827:65770']
  },
  intent: 'Deposits that would trap funds or hit a closed bridge are refused before Review',
  preconditions: ['connected wallet with mainnet USDS', 'on /convert?tab=bridge', 'bridge enabled build'],
  steps: [
    { action: 'open recipient', locator: { testId: 'bridge-recipient-button' } },
    { action: 'type recipient', locator: { testId: 'bridge-recipient-input' } },
    { action: 'save recipient', locator: { testId: 'bridge-recipient-save' } }
  ],
  oracle: 'The recipient modal or the panel shows the refusal and Review stays disabled'
};
