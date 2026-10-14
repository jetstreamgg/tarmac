import type { DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';

const isStored = (stored: PendingBridge[], deposit: DiscoveredDeposit) => {
  const hash = deposit.txHash.toLowerCase();
  return stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);
};

// A queued Safe bridge that executed has no hash until its tracker reads one; it may be this deposit.
const mayBeQueued = (stored: PendingBridge[], deposit: DiscoveredDeposit) =>
  stored.some(
    bridge =>
      !bridge.txHash &&
      bridge.from === 'ethereum' &&
      bridge.to === deposit.to &&
      bridge.amount === deposit.amount
  );

/**
 * Adds the account's discovered deposits that the store lacks (storage
 * cleared, another browser), so one that needs a redeem or a replay is
 * offered before its ticket expires. A deposit that already arrived adds
 * nothing; an unknown progress adds it as pending. Returns how many it added.
 */
export async function recoverDeposits({
  store,
  scope,
  account,
  deposits,
  now,
  blockTime,
  adapter,
  context
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'upsert'>;
  scope: string;
  account: string;
  deposits: DiscoveredDeposit[];
  now: () => number;
  /** The block's timestamp in ms; undefined when it can't be read. */
  blockTime: (blockNumber: bigint) => Promise<number | undefined>;
  adapter: BridgeAdapter;
  context: Parameters<BridgeAdapter['checkProgress']>[2];
}): Promise<number> {
  let added = 0;
  for (const deposit of deposits) {
    const stored = store.getSnapshot(scope);
    if (isStored(stored, deposit) || mayBeQueued(stored, deposit)) continue;
    const startedAt = (await blockTime(deposit.blockNumber)) ?? now();
    const bridge = createPendingBridge({
      account,
      amount: deposit.amount,
      from: 'ethereum',
      to: deposit.to,
      ...(deposit.recipient.toLowerCase() !== account.toLowerCase() && { recipient: deposit.recipient }),
      route: nativeDepositRoute(deposit.to),
      txHash: deposit.txHash,
      now: startedAt
    });
    const progress = await adapter.checkProgress(bridge, now(), context);
    if (progress?.kind === 'arrived' || progress?.kind === 'failed') continue;
    // Read again: the launch or another tab may have stored it during the reads.
    if (isStored(store.getSnapshot(scope), deposit)) continue;
    store.upsert(scope, progress ? applyProgress(bridge, progress, now()) : bridge);
    added += 1;
  }
  return added;
}
