import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Ethereum → OP Stack native USDS deposit: review, confirm, pending card, arrival and replay. */
export const bridgeNativeFlowContract: TestContract = {
  id: 'bridge-native-flow',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['3574:64074', '3574:64110', '3574:64348']
  },
  intent: 'User bridges USDS from Ethereum to an L2 through the native bridge and follows it to arrival',
  preconditions: ['connected wallet with mainnet USDS', 'on /convert?tab=bridge', 'bridge enabled build'],
  steps: [
    { action: 'pick destination', locator: { testId: 'bridge-to-network' } },
    { action: 'enter amount', locator: { testId: 'bridge-from-amount' } },
    { action: 'review', locator: { testId: 'bridge-review-cta' } },
    { action: 'confirm', locator: { role: { type: 'button', name: 'Confirm' } } },
    { action: 'act on the card', locator: { testId: 'pending-bridge-action' } }
  ],
  oracle:
    'A pending card appears after Confirm and turns Arrived once the deposit relays on L2; the L2 USDS balance rises by the amount'
};
