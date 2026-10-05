import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { fakeTxHash } from './mockPendingStore';

// Per-leg timings: time in the wallet, then time to "mine".
const SIGN_MS = 900;
const MINE_MS = 1_400;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Walks the modal through `legs` sequential writes without touching a chain
 * (APP-611 mocks). Reads callbacks through `getCallbacks` so each leg uses the
 * provider's latest session-bound callbacks. Resolves with the last leg's hash.
 */
export async function runMockLegs(legs: number, getCallbacks: () => TxCallbacks): Promise<string> {
  let hash = '';
  for (let leg = 0; leg < legs; leg++) {
    getCallbacks().onMutate();
    await wait(SIGN_MS);
    hash = fakeTxHash();
    getCallbacks().onStart(hash);
    await wait(MINE_MS);
  }
  getCallbacks().onSuccess(hash);
  return hash;
}
