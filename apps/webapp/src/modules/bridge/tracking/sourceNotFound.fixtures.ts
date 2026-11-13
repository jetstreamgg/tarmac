import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { getBridgeAdapter } from '../adapters/registry';
import type { AdapterContext, BridgeAdapter, ChainReader } from '../adapters/types';
import type { PendingBridge } from '../model/types';
import type { PendingBridgeStore } from '../store/pendingStore';
import { trackBridge } from './trackBridge';

/**
 * What the source chain answers about a bridge's hash:
 * - `unknown`: no receipt and no transaction (dropped or replaced).
 * - `mempool`: no receipt yet, the transaction is known.
 * - `mined`: both are known.
 * - `rpc-down`: every read fails.
 * - `tx-read-fails`: no receipt, and the transaction read fails.
 */
export type SourceState = 'unknown' | 'mempool' | 'mined' | 'rpc-down' | 'tx-read-fails';

const unexpected = async () => {
  throw new Error('unexpected read');
};

/** A source chain whose answer about any hash is `state`; every other read fails. */
export function sourceChain(from: PendingBridge['from'], initial: SourceState = 'unknown') {
  const chain = { state: initial as SourceState };
  const reads = { getTransactionReceipt: unexpected, getTransaction: unexpected };
  const others = { readContract: unexpected, call: unexpected, getBlock: unexpected, getLogs: unexpected };
  const source = {
    ...others,
    getBlockNumber: unexpected,
    getTransactionReceipt: async ({ hash }: { hash: Hex }) => {
      if (chain.state === 'rpc-down') throw new Error('rate limited');
      if (chain.state === 'mined') return { status: 'success', logs: [] };
      throw new TransactionReceiptNotFoundError({ hash });
    },
    getTransaction: async ({ hash }: { hash: Hex }) => {
      if (chain.state === 'unknown') throw new TransactionNotFoundError({ hash });
      if (chain.state === 'rpc-down' || chain.state === 'tx-read-fails') throw new Error('rate limited');
      return { hash };
    }
  };
  const other = { ...others, ...reads, getBlockNumber: unexpected };
  const context: AdapterContext = {
    getClient: network => (network === from ? source : other) as unknown as ChainReader
  };
  return { chain, context };
}

/** One tracker poll at `now`, through the route's real adapter unless `adapter` is given. */
export const pollAt = ({
  store,
  scope,
  id,
  now,
  context,
  adapter
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'update'>;
  scope: string;
  id: string;
  now: number;
  context: AdapterContext;
  adapter?: BridgeAdapter;
}) =>
  trackBridge({
    store,
    scope,
    id,
    now: () => now,
    getAdapter: entry => adapter ?? getBridgeAdapter(entry.routeKind),
    context,
    readSafeTx: async () => null,
    readSafeAction: async () => null
  });

/** `bridge` as the tracker leaves it after one poll at `now` against a source chain that has no record of its hash. */
export async function afterUnknownSourcePoll(bridge: PendingBridge, now: number): Promise<PendingBridge> {
  let stored = bridge;
  await pollAt({
    store: {
      getSnapshot: () => [stored],
      update: (_scope, _id, change) => {
        stored = change(stored);
      }
    },
    scope: 'fixture',
    id: bridge.id,
    now,
    context: sourceChain(bridge.from).context
  });
  return stored;
}
