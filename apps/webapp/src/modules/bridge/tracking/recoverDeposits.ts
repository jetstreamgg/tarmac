import type { DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import type { BridgeNetworkId } from '../model/networks';
import { applyProgress, createPendingBridge, failBundle, isSettled } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';
import { bundleDepositIn, sendsTo, type BundleReceipt } from './bundleDeposit';

const isStored = (stored: PendingBridge[], deposit: DiscoveredDeposit) => {
  const hash = deposit.txHash.toLowerCase();
  return stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);
};

// The device clock that stamped a queued bridge may run ahead of the chain's, by an unknown amount.
const CLOCK_SKEW_MS = 60 * 60_000;
// The same, once the chain's time is known: block times lag and the device clock drifts.
const KNOWN_SKEW_MS = 10 * 60_000;

// A queued Safe bridge or a wallet bundle has no hash until one is read: it may be one deposit of its network and amount, mined after it was queued.
const mayBeQueued = (
  bridge: PendingBridge,
  deposit: DiscoveredDeposit,
  minedAt: number | undefined,
  offset: number | undefined
) =>
  !bridge.txHash &&
  (!!bridge.safeTxHash || (!!bridge.bundleId && sendsTo(bridge, deposit))) &&
  !isSettled(bridge) &&
  bridge.from === 'ethereum' &&
  bridge.to === deposit.to &&
  bridge.amount === deposit.amount &&
  (minedAt === undefined ||
    (offset === undefined
      ? minedAt >= bridge.startedAt - CLOCK_SKEW_MS
      : minedAt + offset >= bridge.startedAt - KNOWN_SKEW_MS));

const executedIt = (bridge: PendingBridge, executed: string[] | undefined) =>
  !!executed?.some(hash => hash.toLowerCase() === bridge.safeTxHash?.toLowerCase());

/** What the wallet reports for a bundle it accepted; undefined when it can't say. */
export type CallsStatus = { status?: 'pending' | 'success' | 'failure'; receipts?: readonly BundleReceipt[] };

/**
 * Adds the account's discovered deposits that the store lacks (storage
 * cleared, another browser), so one that needs a redeem or a replay is
 * offered before its ticket expires. A deposit that already arrived adds
 * nothing and joins `settled`, which later runs skip; an unknown progress adds
 * it as pending. A wallet bundle's card gets the hash of its deposit from the
 * wallet's receipts, else of the deposit it matches, oldest card first; one
 * the wallet reports failed with no deposit fails. Times read from Ethereum
 * are moved to the device clock when `chainNow` is known; a time read on an
 * L2 moves by that L2's own clock from `chainNowOn`, and the card keeps its
 * start when that can't be read. Checks the deposits in parallel. Returns how many it added.
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
  executedSafeTxHashes,
  chainNow,
  chainNowOn,
  callsStatus
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'upsert' | 'update' | 'resolveBundle'>;
  scope: string;
  account: string;
  deposits: DiscoveredDeposit[];
  now: () => number;
  /** The block's timestamp in ms, on `network` (Ethereum when not given); undefined when it can't be read. */
  blockTime: (blockNumber: bigint, network?: BridgeNetworkId) => Promise<number | undefined>;
  adapter: BridgeAdapter;
  context: Parameters<BridgeAdapter['checkProgress']>[2];
  /** Lowercase hashes of deposits that arrived or moved no funds. */
  settled: Set<string>;
  /** The Safe tx hashes the deposit's transaction executed; undefined when unread, empty when none was logged. */
  executedSafeTxHashes?: (txHash: string) => Promise<string[] | undefined>;
  /** The chain's time at the scan's last block in ms; undefined when unread. */
  chainNow?: number;
  /** An L2's time at its latest block in ms; undefined when unread. Read at most once per network per run. */
  chainNowOn?: (network: BridgeNetworkId) => Promise<number | undefined>;
  /** The wallet's status of a bundle by its calls id. */
  callsStatus?: (callsId: string) => Promise<CallsStatus | undefined>;
}): Promise<number> {
  // How far the device clock runs ahead of the chain's.
  const offset = chainNow === undefined ? undefined : now() - chainNow;
  const onDevice = (at: number | undefined) => (at === undefined || offset === undefined ? at : at + offset);
  // An L2's block time only moves to the device clock by that L2's offset.
  const l2Offsets = new Map<BridgeNetworkId, Promise<number | undefined>>();
  const l2Offset = (network: BridgeNetworkId) => {
    const read =
      l2Offsets.get(network) ??
      (chainNowOn ? chainNowOn(network).catch(() => undefined) : Promise.resolve(undefined)).then(l2Now =>
        l2Now === undefined ? undefined : now() - l2Now
      );
    l2Offsets.set(network, read);
    return read;
  };
  // Unconverted, an L2 bundle keeps the time the device sent it at.
  const onDeviceFrom = async (bridge: PendingBridge, at: number | undefined) => {
    if (bridge.from === 'ethereum') return onDevice(at);
    const l2 = at === undefined ? undefined : await l2Offset(bridge.from);
    return at === undefined || l2 === undefined ? bridge.startedAt : at + l2;
  };
  if (callsStatus) {
    const unmined = store
      .getSnapshot(scope)
      .filter(bridge => bridge.bundleId && bridge.callsId && !bridge.txHash && !isSettled(bridge));
    await Promise.all(
      unmined.map(async bridge => {
        try {
          const reported = bridge.callsId ? await callsStatus(bridge.callsId) : undefined;
          if (!reported?.status || reported.status === 'pending') return;
          const found = bundleDepositIn(bridge, reported.receipts ?? []);
          if (found)
            store.resolveBundle(
              scope,
              bridge.id,
              found.txHash,
              await onDeviceFrom(bridge, await blockTime(found.blockNumber, bridge.from))
            );
          else if (reported.status === 'failure')
            store.update(scope, bridge.id, current => failBundle(current, 'source-tx-reverted', now()));
        } catch {
          // An answer it can't read says nothing: the scan below still runs for every card.
        }
      })
    );
  }
  const stored = store.getSnapshot(scope);
  const unknown = deposits.filter(
    deposit => !settled.has(deposit.txHash.toLowerCase()) && !isStored(stored, deposit)
  );
  const minedAt = await Promise.all(unknown.map(deposit => blockTime(deposit.blockNumber)));
  const executed = await Promise.all(
    unknown.map((deposit, i) =>
      executedSafeTxHashes && stored.some(bridge => mayBeQueued(bridge, deposit, minedAt[i], offset))
        ? executedSafeTxHashes(deposit.txHash)
        : undefined
    )
  );
  // Each queued bridge may be only one deposit: the one that executed its Safe tx, else the earliest unread one.
  const covered = new Map<number, PendingBridge>();
  const order = unknown
    .map((_, i) => i)
    .sort((a, b) => Number(unknown[a].blockNumber - unknown[b].blockNumber));
  const open = (bridge: PendingBridge, i: number) =>
    !covered.has(i) && mayBeQueued(bridge, unknown[i], minedAt[i], offset);
  // The oldest card takes the earliest deposit, so a later one can't take an earlier one's.
  const queued = stored
    .filter(bridge => order.some(i => open(bridge, i)))
    .sort((a, b) => a.startedAt - b.startedAt);
  const unmatched = queued.filter(bridge => {
    const i = order.find(i => open(bridge, i) && executedIt(bridge, executed[i]));
    if (i !== undefined) covered.set(i, bridge);
    return i === undefined;
  });
  for (const bridge of unmatched) {
    const i = order.find(i => open(bridge, i) && !executed[i]?.length);
    if (i !== undefined) covered.set(i, bridge);
  }
  // A Safe's tracker reads its own hash; a bundle has no tracker until it has one.
  for (const [i, bridge] of covered) {
    if (bridge.bundleId) store.resolveBundle(scope, bridge.id, unknown[i].txHash, onDevice(minedAt[i]));
  }

  const recover = async (deposit: DiscoveredDeposit, i: number) => {
    if (covered.has(i)) return false;
    const hash = deposit.txHash.toLowerCase();
    const startedAt = onDevice(minedAt[i]) ?? now();
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
