import { applyProgress, isSettled, type BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeAction } from '../model/types';
import type { BridgeAdapter } from '../adapters/types';
import type { PendingBridgeStore } from '../store/pendingStore';

const fingerprint = (bridge: PendingBridge) =>
  JSON.stringify({ ...bridge, amount: bridge.amount.toString() });

/**
 * One poll of one bridge: resolve a queued Safe transaction first, then a
 * destination action a Safe sent, then ask the route adapter. Writes the
 * result to the store and returns it.
 */
export async function trackBridge({
  store,
  scope,
  id,
  now,
  getAdapter,
  readSafeTx,
  readSafeAction
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'update'>;
  scope: string;
  id: string;
  now: () => number;
  getAdapter: (bridge: PendingBridge) => BridgeAdapter;
  readSafeTx: (bridge: PendingBridge & { safeTxHash: string }) => Promise<BridgeProgress | null>;
  readSafeAction: (bridge: PendingBridge, sent: PendingBridgeAction) => Promise<BridgeProgress | null>;
}): Promise<BridgeProgress | null> {
  const bridge = store.getSnapshot(scope).find(entry => entry.id === id);
  if (!bridge || isSettled(bridge)) return null;
  // No route adapter can match a Safe tx hash on chain.
  const safeAction = bridge.actions.find(sent => sent.status === 'sent' && sent.safe);
  const progress = bridge.txHash
    ? ((safeAction && (await readSafeAction(bridge, safeAction))) ??
      (await getAdapter(bridge).checkProgress(bridge, now())))
    : bridge.safeTxHash
      ? await readSafeTx({ ...bridge, safeTxHash: bridge.safeTxHash })
      : null;
  if (!progress) return null;
  const polled = fingerprint(bridge);
  let applied = false;
  store.update(scope, id, current => {
    // The entry changed during the poll (an action was recorded): the result is stale.
    if (fingerprint(current) !== polled) return current;
    applied = true;
    const next = applyProgress(current, progress, now());
    // Repeated polls report the same state; skip the write.
    return fingerprint(next) === polled ? current : next;
  });
  return applied ? progress : null;
}
