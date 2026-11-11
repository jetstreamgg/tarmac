import type { Hex } from 'viem';
import type { DiscoveredWithdrawal } from '../adapters/nativeWithdrawal/discovery';
import type { NativeWithdrawalLookup } from '../adapters/nativeWithdrawal/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { applyProgress, isSettled } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';
import { CLOCK_SKEW_MS } from './recoverDeposits';

const storesHash = (stored: PendingBridge[], hash: string) =>
  stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// A wallet bundle has no hash until one is read: it may be one withdrawal of its network, sender, amount and recipient, mined after it was sent.
const mayBeBundle = (card: PendingBridge, found: PendingBridge) =>
  !!card.bundleId &&
  !card.txHash &&
  !isSettled(card) &&
  card.routeKind === 'native' &&
  card.to === 'ethereum' &&
  card.from === found.from &&
  card.amount === found.amount &&
  sameAddress(card.account, found.account) &&
  sameAddress(card.recipient ?? card.account, found.recipient ?? found.account) &&
  found.startedAt >= card.startedAt - CLOCK_SKEW_MS;

/**
 * Adds the discovered native withdrawals the store lacks (storage cleared,
 * another browser, a withdrawal sent to this wallet), so each is proved and
 * finalized from its card. Each is read with `lookup`, which checks its
 * receipt. A wallet bundle's card with no hash gets the hash of the withdrawal
 * it matches, oldest card first, instead of a second card. One that arrived,
 * failed or isn't a bridge joins `settled`, which later runs skip; a read
 * error leaves it for the next run. Returns how many it added.
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
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'upsert' | 'resolveBundle'>;
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
  const read = async ({ txHash, blockNumber }: DiscoveredWithdrawal) => {
    const hash = txHash.toLowerCase();
    try {
      const found = await lookup(txHash);
      if (found.status === 'refused') {
        settled.add(hash);
        return undefined;
      }
      const progress = await adapter.checkProgress(found.bridge, now(), context);
      return { hash, blockNumber, bridge: found.bridge, progress };
    } catch {
      return undefined;
    }
  };
  const found = (await Promise.all(unknown.map(read)))
    .filter(reading => reading !== undefined)
    .sort((a, b) => Number(a.blockNumber - b.blockNumber));
  let added = 0;
  for (const { hash, bridge, progress } of found) {
    // Read again: the launch or another tab may have stored it during the reads.
    const current = store.getSnapshot(scope);
    if (storesHash(current, hash)) continue;
    // The oldest card takes the earliest withdrawal, and keeps the time the device sent it at.
    const card = current
      .filter(entry => mayBeBundle(entry, bridge))
      .sort((a, b) => a.startedAt - b.startedAt)
      .at(0);
    if (card) {
      store.resolveBundle(scope, card.id, hash, card.startedAt);
      continue;
    }
    if (progress?.kind === 'arrived' || progress?.kind === 'failed') {
      settled.add(hash);
      continue;
    }
    store.upsert(scope, progress ? applyProgress(bridge, progress, now()) : bridge);
    added += 1;
  }
  return added;
}
