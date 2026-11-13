import { isAddress, type Hex } from 'viem';
import { cctpBurnAmount } from '../adapters/cctp/calls';
import { CCTP_DOMAIN, addressToBytes32, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import { cctpScanFromBlock, discoverCctpBurns, type DiscoveredBurn } from '../adapters/cctp/discovery';
import { WITHDRAWAL_SCAN_BLOCKS } from '../adapters/nativeWithdrawal/discovery';
import type { ChainReader } from '../adapters/types';
import {
  BUNDLE_UNSEEN_MS,
  awaitsBurnScan,
  clearBundleUnseen,
  markBundleUnseen
} from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';
import { bundleDepositIn, type BundleReceipt } from './bundleDeposit';
import { KNOWN_SKEW_MS } from './recoverDeposits';

const mayBeBurnOf = (bridge: PendingBridge, burn: DiscoveredBurn) => {
  const recipient = bridge.recipient ?? bridge.account;
  return (
    isAddress(recipient) &&
    burn.destinationDomain === CCTP_DOMAIN.ethereum &&
    burn.amount === cctpBurnAmount(bridge.amount) &&
    burn.mintRecipient.toLowerCase() === addressToBytes32(recipient)
  );
};

/** What a client read of blocks older than a scan window, which no longer change: a retry reads only what failed. */
const settledReads = new WeakMap<
  object,
  { burns: Map<string, DiscoveredBurn[]>; seconds: Map<string, number> }
>();
const settledReadsOf = (client: object) => {
  let reads = settledReads.get(client);
  if (!reads) settledReads.set(client, (reads = { burns: new Map(), seconds: new Map() }));
  return reads;
};

/**
 * Gives the CCTP wallet bundles of `network` that have no hash the burn they
 * sent, read from the L2's logs by account: the wallet can't always report
 * it. Oldest card first, each takes the earliest burn of its amount and
 * recipient mined after it was sent that no card follows. A card with no such
 * burn 30 minutes after it was sent is stamped, so it may be dismissed, when
 * the logs read reach back to its send: for a card older than the scan window
 * the older blocks are read too, once, and the card keeps the block it was
 * read up to. A card whose blocks back to its send can't be read is left as it is.
 * Returns whether everything was read.
 */
export async function recoverCctpBundles({
  store,
  scope,
  account,
  network,
  client,
  now
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'update' | 'resolveBundle'>;
  scope: string;
  account: string;
  network: CctpL2NetworkId;
  client: Pick<ChainReader, 'getBlock' | 'getLogs' | 'getTransactionReceipt'>;
  now: () => number;
}): Promise<boolean> {
  const waiting = () =>
    store
      .getSnapshot(scope)
      .filter(bridge => awaitsBurnScan(bridge) && bridge.from === network)
      .sort((a, b) => a.startedAt - b.startedAt);
  if (waiting().length === 0) return true;

  let head: { number: bigint | null; timestamp: bigint };
  try {
    head = await client.getBlock();
  } catch {
    return false;
  }
  const headBlock = head.number;
  if (headBlock === null) return false;
  const l2Now = Number(head.timestamp) * 1000;
  // How far the device clock runs ahead of the L2's.
  const offset = now() - l2Now;
  const { burns, complete } = await discoverCctpBurns({ l2: client, network, account, toBlock: headBlock });
  if (!complete) return false;

  const cards = waiting();
  const window = WITHDRAWAL_SCAN_BLOCKS[network];
  const fromBlock = cctpScanFromBlock(network, headBlock);
  const settled = settledReadsOf(client);
  /** Device time of a block; `null` when it can't be told. */
  const minedAtOf = async (block: bigint): Promise<number | null> => {
    const key = `${network}:${block}`;
    let seconds = settled.seconds.get(key);
    if (seconds === undefined) {
      try {
        seconds = Number((await client.getBlock({ blockNumber: block })).timestamp);
      } catch {
        return null;
      }
      if (block < fromBlock) settled.seconds.set(key, seconds);
    }
    return seconds * 1000 + offset;
  };
  /** The account's burns in blocks older than the window; `null` when they can't be read. */
  const olderBurns = async (from: bigint, to: bigint): Promise<DiscoveredBurn[] | null> => {
    const key = `${network}:${account.toLowerCase()}:${from}`;
    const whole = to - from + 1n === window;
    const known = whole ? settled.burns.get(key) : undefined;
    if (known) return known;
    const older = await discoverCctpBurns({ l2: client, network, account, fromBlock: from, toBlock: to });
    if (!older.complete) return null;
    if (whole) settled.burns.set(key, older.burns);
    return older.burns;
  };
  /** The block an earlier read from the card's send went up to, when it can be believed. */
  const readTo = (card: PendingBridge) => {
    const mark = card.bundleReadTo;
    if (mark === undefined || !/^\d+$/.test(mark)) return null;
    const block = BigInt(mark);
    return block <= headBlock ? block : null;
  };

  // A head far behind hasn't shown the 30 minutes after the send.
  const due = cards.filter(card => l2Now >= card.startedAt + BUNDLE_UNSEEN_MS - KNOWN_SKEW_MS);
  /** The first block read. */
  let low = fromBlock;
  /** The cards whose send the blocks read don't reach back to: their burn may be older. */
  let behind = due;
  // Stops short of the cards left behind when the time of a block, or older blocks, can't be read.
  for (;;) {
    const first = low;
    behind = behind.filter(card => {
      const to = readTo(card);
      return first > 0n && (to === null || to + 1n < first);
    });
    if (behind.length === 0) break;
    const since = await minedAtOf(low);
    if (since === null) break;
    behind = behind.filter(card => since >= card.startedAt - KNOWN_SKEW_MS);
    if (behind.length === 0) break;
    // Older blocks in stretches that start on a multiple of the window, so they are the same on every scan.
    const to = low - 1n;
    const from = (to / window) * window;
    const older = await olderBurns(from, to);
    if (older === null) break;
    burns.push(...older);
    low = from;
  }

  const tracked = new Set(
    store.getSnapshot(scope).flatMap(bridge => [bridge.id.toLowerCase(), bridge.txHash?.toLowerCase()])
  );
  const untracked = burns.filter(burn => !tracked.has(burn.txHash.toLowerCase()));
  const hashes = [
    ...new Set(untracked.filter(burn => cards.some(card => mayBeBurnOf(card, burn))).map(burn => burn.txHash))
  ];
  let mined: { txHash: Hex; blockNumber: bigint; minedAt: number; receipt: BundleReceipt }[];
  try {
    mined = await Promise.all(
      hashes.map(async txHash => {
        const receipt = await client.getTransactionReceipt({ hash: txHash });
        const block = await client.getBlock({ blockNumber: receipt.blockNumber });
        return {
          txHash,
          blockNumber: receipt.blockNumber,
          minedAt: Number(block.timestamp) * 1000 + offset,
          receipt
        };
      })
    );
  } catch {
    return false;
  }
  mined.sort((a, b) => Number(a.blockNumber - b.blockNumber));

  const taken = new Set<Hex>();
  const mayBeIts = (card: PendingBridge, tx: (typeof mined)[number]) =>
    !taken.has(tx.txHash) &&
    tx.minedAt >= card.startedAt - KNOWN_SKEW_MS &&
    untracked.some(burn => burn.txHash === tx.txHash && mayBeBurnOf(card, burn));
  let read = true;
  for (const card of cards) {
    // Its own burn may be in the blocks that weren't read: a later one isn't given to it.
    if (behind.includes(card)) {
      read = false;
      continue;
    }
    const its = mined.find(
      tx =>
        mayBeIts(card, tx) &&
        bundleDepositIn(card, [tx.receipt])?.txHash.toLowerCase() === tx.txHash.toLowerCase()
    );
    if (its) {
      taken.add(its.txHash);
      store.resolveBundle(scope, card.id, its.txHash, its.minedAt);
      continue;
    }
    // A burn that may be its own but isn't clearly one: the card stays.
    if (mined.some(tx => mayBeIts(card, tx))) store.update(scope, card.id, clearBundleUnseen);
    else if (due.includes(card))
      store.update(scope, card.id, current => markBundleUnseen(current, now(), headBlock));
  }
  return read;
}
