import type { BridgeRoute, PendingBridge } from '../model/types';
import type { BridgeNetworkId } from '../model/networks';

// Mock progression: a started bridge becomes ready/arrived after this delay,
// so the whole flow can be walked in dev without waiting for the real ETA.
const MOCK_PROGRESS_MS = 15_000;

type Listener = () => void;

let pending: PendingBridge[] = [];
const listeners = new Set<Listener>();

const emit = (next: PendingBridge[]) => {
  pending = next;
  listeners.forEach(listener => listener());
};

const update = (id: string, patch: Partial<PendingBridge>) =>
  emit(pending.map(bridge => (bridge.id === id ? { ...bridge, ...patch } : bridge)));

export const fakeTxHash = () =>
  `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

/** In-memory pending bridges for APP-611; the real store (APP-612) replaces it. */
export const mockPendingStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => pending,
  add(input: {
    amount: bigint;
    from: BridgeNetworkId;
    to: BridgeNetworkId;
    recipient?: string;
    route: BridgeRoute;
    txHash: string;
  }) {
    const now = Date.now();
    const bridge: PendingBridge = {
      id: input.txHash,
      amount: input.amount,
      token: 'USDS',
      from: input.from,
      to: input.to,
      recipient: input.recipient,
      status: 'pending',
      routeKind: input.route.kind,
      requiresClaim: input.route.requiresClaim,
      startedAt: now,
      etaAt: now + input.route.etaMinutes * 60_000,
      txHash: input.txHash
    };
    emit([bridge, ...pending]);
    setTimeout(
      () =>
        update(
          bridge.id,
          input.route.requiresClaim ? { status: 'ready', nextAction: 'claim' } : { status: 'arrived' }
        ),
      MOCK_PROGRESS_MS
    );
    return bridge;
  },
  markClaimed(id: string, claimTxHash: string) {
    update(id, { status: 'claimed', nextAction: undefined, claimTxHash, claimedAt: Date.now() });
  }
};
