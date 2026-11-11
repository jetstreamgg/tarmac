import { isAddress, type Hex } from 'viem';
import { cctpBurnAmount } from '../adapters/cctp/calls';
import { CCTP_DOMAIN, addressToBytes32, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import { cctpScanFromBlock, discoverCctpBurns, type DiscoveredBurn } from '../adapters/cctp/discovery';
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

/**
 * Gives the CCTP wallet bundles of `network` that have no hash the burn they
 * sent, read from the L2's logs by account: the wallet can't always report
 * it. Oldest card first, each takes the earliest burn of its amount and
 * recipient mined after it was sent that no card follows. A card with no such
 * burn 30 minutes after it was sent is stamped, so it may be dismissed, when
 * the logs read reach back to its send. Any read that fails changes nothing.
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
  if (head.number === null) return false;
  const l2Now = Number(head.timestamp) * 1000;
  // How far the device clock runs ahead of the L2's.
  const offset = now() - l2Now;
  const { burns, complete } = await discoverCctpBurns({ l2: client, network, account, toBlock: head.number });
  if (!complete) return false;
  /** Device time of the first block read, once asked; `null` when it can't be told. */
  let readFrom: Promise<number | null> | undefined;
  const fromBlock = cctpScanFromBlock(network, head.number);
  const readSince = () =>
    (readFrom ??=
      fromBlock === 0n
        ? Promise.resolve(0)
        : client.getBlock({ blockNumber: fromBlock }).then(
            block => Number(block.timestamp) * 1000 + offset,
            () => null
          ));

  const cards = waiting();
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
    // A head far behind hasn't shown the 30 minutes after the send.
    else if (l2Now >= card.startedAt + BUNDLE_UNSEEN_MS - KNOWN_SKEW_MS) {
      const since = await readSince();
      if (since === null) read = false;
      // A burn from before the first block read was not looked for.
      else if (since <= card.startedAt - KNOWN_SKEW_MS)
        store.update(scope, card.id, current => markBundleUnseen(current, now()));
    }
  }
  return read;
}
