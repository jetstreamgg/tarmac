import type { DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import { applyProgress, createPendingBridge, isSettled } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';

const isStored = (stored: PendingBridge[], deposit: DiscoveredDeposit) => {
  const hash = deposit.txHash.toLowerCase();
  return stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);
};

// The device clock that stamped a queued bridge may run ahead of the chain's.
const CLOCK_SKEW_MS = 60 * 60_000;

// A queued Safe bridge that executed has no hash until its tracker reads one: it may be one deposit of its network and amount, mined after it was queued.
const mayBeQueued = (bridge: PendingBridge, deposit: DiscoveredDeposit, minedAt: number | undefined) =>
  !bridge.txHash &&
  !!bridge.safeTxHash &&
  !isSettled(bridge) &&
  bridge.from === 'ethereum' &&
  bridge.to === deposit.to &&
  bridge.amount === deposit.amount &&
  (minedAt === undefined || minedAt >= bridge.startedAt - CLOCK_SKEW_MS);

const executedIt = (bridge: PendingBridge, executed: string[] | undefined) =>
  !!executed?.some(hash => hash.toLowerCase() === bridge.safeTxHash?.toLowerCase());

/**
 * Adds the account's discovered deposits that the store lacks (storage
 * cleared, another browser), so one that needs a redeem or a replay is
 * offered before its ticket expires. A deposit that already arrived adds
 * nothing and joins `settled`, which later runs skip; an unknown progress adds
 * it as pending. Checks the deposits in parallel. Returns how many it added.
 */
export async function recoverDeposits({
  store,
  scope,
  account,
  deposits,
  now,
  blockTime,
  adapter,
  context,
  settled,
  executedSafeTxHashes
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
  /** Lowercase hashes of deposits that arrived or moved no funds. */
  settled: Set<string>;
  /** The Safe tx hashes the deposit's transaction executed; undefined when unread, empty when none was logged. */
  executedSafeTxHashes?: (txHash: string) => Promise<string[] | undefined>;
}): Promise<number> {
  const stored = store.getSnapshot(scope);
  const unknown = deposits.filter(
    deposit => !settled.has(deposit.txHash.toLowerCase()) && !isStored(stored, deposit)
  );
  const minedAt = await Promise.all(unknown.map(deposit => blockTime(deposit.blockNumber)));
  const executed = await Promise.all(
    unknown.map((deposit, i) =>
      executedSafeTxHashes && stored.some(bridge => mayBeQueued(bridge, deposit, minedAt[i]))
        ? executedSafeTxHashes(deposit.txHash)
        : undefined
    )
  );
  // Each queued bridge may be only one deposit: the one that executed its Safe tx, else the earliest unread one.
  const covered = new Set<number>();
  const order = unknown
    .map((_, i) => i)
    .sort((a, b) => Number(unknown[a].blockNumber - unknown[b].blockNumber));
  const open = (bridge: PendingBridge, i: number) =>
    !covered.has(i) && mayBeQueued(bridge, unknown[i], minedAt[i]);
  const queued = stored.filter(bridge => order.some(i => open(bridge, i)));
  const unmatched = queued.filter(bridge => {
    const i = order.find(i => open(bridge, i) && executedIt(bridge, executed[i]));
    if (i !== undefined) covered.add(i);
    return i === undefined;
  });
  for (const bridge of unmatched) {
    const i = order.find(i => open(bridge, i) && !executed[i]?.length);
    if (i !== undefined) covered.add(i);
  }

  const recover = async (deposit: DiscoveredDeposit, i: number) => {
    if (covered.has(i)) return false;
    const hash = deposit.txHash.toLowerCase();
    const startedAt = minedAt[i] ?? now();
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
    if (progress?.kind === 'arrived' || progress?.kind === 'failed') {
      settled.add(hash);
      return false;
    }
    // Read again: the launch or another tab may have stored it during the reads.
    if (isStored(store.getSnapshot(scope), deposit)) return false;
    store.upsert(scope, progress ? applyProgress(bridge, progress, now()) : bridge);
    return true;
  };
  return (await Promise.all(unknown.map(recover))).filter(Boolean).length;
}
