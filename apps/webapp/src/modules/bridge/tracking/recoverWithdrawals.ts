import type { Hex } from 'viem';
import type { DiscoveredWithdrawal } from '../adapters/nativeWithdrawal/discovery';
import type { NativeWithdrawalLookup } from '../adapters/nativeWithdrawal/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { applyProgress } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';

const storesHash = (stored: PendingBridge[], hash: string) =>
  stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);

/**
 * Adds the discovered native withdrawals the store lacks (storage cleared,
 * another browser, a withdrawal sent to this wallet), so each is proved and
 * finalized from its card. Each is read with `lookup`, which checks its
 * receipt. One that arrived, failed or isn't a bridge joins `settled`, which
 * later runs skip; a read error leaves it for the next run. Returns how many it added.
 */
export async function recoverWithdrawals({
  store,
  scope,
  withdrawals,
  lookup,
  now,
  adapter,
  context,
  settled
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'upsert'>;
  scope: string;
  withdrawals: DiscoveredWithdrawal[];
  lookup: (txHash: Hex) => Promise<NativeWithdrawalLookup>;
  now: () => number;
  adapter: BridgeAdapter;
  context: Parameters<BridgeAdapter['checkProgress']>[2];
  /** Lowercase hashes of withdrawals that arrived, failed or aren't bridges. */
  settled: Set<string>;
}): Promise<number> {
  const stored = store.getSnapshot(scope);
  const unknown = withdrawals.filter(({ txHash }) => {
    const hash = txHash.toLowerCase();
    return !settled.has(hash) && !storesHash(stored, hash);
  });
  const recover = async ({ txHash }: DiscoveredWithdrawal) => {
    const hash = txHash.toLowerCase();
    try {
      const found = await lookup(txHash);
      if (found.status === 'refused') {
        settled.add(hash);
        return false;
      }
      const progress = await adapter.checkProgress(found.bridge, now(), context);
      if (progress?.kind === 'arrived' || progress?.kind === 'failed') {
        settled.add(hash);
        return false;
      }
      // Read again: the launch or another tab may have stored it during the reads.
      if (storesHash(store.getSnapshot(scope), hash)) return false;
      store.upsert(scope, progress ? applyProgress(found.bridge, progress, now()) : found.bridge);
      return true;
    } catch {
      return false;
    }
  };
  return (await Promise.all(unknown.map(recover))).filter(Boolean).length;
}
