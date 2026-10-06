import { applyProgress, isSettled, type BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { BridgeAdapter } from '../adapters/types';
import type { PendingBridgeStore } from '../store/pendingStore';

const fingerprint = (bridge: PendingBridge) =>
  JSON.stringify({ ...bridge, amount: bridge.amount.toString() });

/**
 * One poll of one bridge: resolve a queued Safe transaction first, then ask the
 * route adapter. Writes the result to the store and returns it.
 */
export async function trackBridge({
  store,
  scope,
  id,
  now,
  getAdapter,
  readSafeTx
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'update'>;
  scope: string;
  id: string;
  now: () => number;
  getAdapter: (bridge: PendingBridge) => BridgeAdapter;
  readSafeTx: (bridge: PendingBridge & { safeTxHash: string }) => Promise<BridgeProgress | null>;
}): Promise<BridgeProgress | null> {
  const bridge = store.getSnapshot(scope).find(entry => entry.id === id);
  if (!bridge || isSettled(bridge)) return null;
  const progress = bridge.txHash
    ? await getAdapter(bridge).checkProgress(bridge, now())
    : bridge.safeTxHash
      ? await readSafeTx({ ...bridge, safeTxHash: bridge.safeTxHash })
      : null;
  if (!progress) return null;
  store.update(scope, id, current => {
    const next = applyProgress(current, progress, now());
    // Repeated polls report the same state; skip the write.
    return fingerprint(next) === fingerprint(current) ? current : next;
  });
  return progress;
}
