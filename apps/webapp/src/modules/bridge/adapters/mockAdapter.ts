import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import type { BridgeAdapter } from './types';

// Each stage (arrival, or the next destination action) is ready this long after the previous one.
export const MOCK_STAGE_MS = 15_000;
// Per-leg timings: time in the wallet, then time to "mine".
const SIGN_MS = 900;
const MINE_MS = 1_400;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fakeTxHash = () =>
  `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

/** Stand-in for every route until the route tickets (APP-613 to APP-617) add theirs. */
export const mockAdapter: BridgeAdapter = {
  async checkProgress(bridge, now) {
    const since = bridge.actions.at(-1)?.at ?? bridge.startedAt;
    if (now - since < MOCK_STAGE_MS) return null;
    return bridge.nextAction ? { kind: 'ready', nextAction: bridge.nextAction } : { kind: 'arrived' };
  }
};

/**
 * Walks the modal through one sequential write per function name without
 * touching a chain, reporting each name at `onMutate` like the real flow.
 * Reads callbacks through `getCallbacks` so each leg uses the provider's
 * latest session-bound callbacks. Resolves with the last leg's hash.
 */
export async function runMockLegs(functionNames: string[], getCallbacks: () => TxCallbacks): Promise<string> {
  let hash = '';
  for (const functionName of functionNames) {
    getCallbacks().onMutate({ functionName });
    await wait(SIGN_MS);
    hash = fakeTxHash();
    getCallbacks().onStart(hash);
    await wait(MINE_MS);
  }
  getCallbacks().onSuccess(hash);
  return hash;
}
