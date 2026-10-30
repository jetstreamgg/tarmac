import { getAbiItem, zeroHash, type Hex } from 'viem';
import { isSettled, type BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { safeExecutionFailed } from '../safe';
import { L1_SENT_ACTION_DROPPED_MS, settleSentAction } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import {
  ARBITRUM_CONFIRM_MS,
  ARBITRUM_WITHDRAWAL,
  arbitrumOutboxAbi,
  nodeInterfaceOutboxAbi
} from './contracts';
import { NODE_INTERFACE } from '../nativeDeposit/contracts';
import {
  arbitrumExecuteCall,
  arbitrumItemHash,
  arbitrumWithdrawalMessage,
  type ArbitrumWithdrawalMessage
} from './arbitrum';
import { matchesBridge } from './message';

const SEND_ROOT_UPDATED = getAbiItem({ abi: arbitrumOutboxAbi, name: 'SendRootUpdated' });
/** How far back the newest confirmed send root is looked for: the rollup confirms about hourly. */
const SEND_ROOT_SCAN_BLOCKS = [2_000n, 14_400n];
/** How long before its ETA a message's send root is first looked for; the rollup can't confirm it sooner. */
const CONFIRM_LEAD_MS = 24 * 60 * 60 * 1000;

/** The newest send root the outbox holds, and how many messages it commits to. */
async function readConfirmedSend(l1: ChainReader, l2: ChainReader) {
  const head = await l1.getBlockNumber();
  for (const range of SEND_ROOT_SCAN_BLOCKS) {
    const logs = await l1.getLogs({
      address: ARBITRUM_WITHDRAWAL.outbox,
      event: SEND_ROOT_UPDATED,
      fromBlock: head > range ? head - range : 0n,
      toBlock: head
    });
    const newest = logs.at(-1);
    if (!newest?.args.outputRoot || !newest.args.l2BlockHash) continue;
    // Arbitrum's blocks carry how many L2 to L1 messages were sent up to them.
    const block = (await l2.getBlock({ blockHash: newest.args.l2BlockHash })) as { sendCount?: string };
    if (block.sendCount === undefined) return undefined;
    return { sendRoot: newest.args.outputRoot, size: BigInt(block.sendCount) };
  }
  return undefined;
}

async function readMessage(
  l2: ChainReader,
  bridge: PendingBridge
): Promise<ArbitrumWithdrawalMessage | { failed: BridgeProgress } | undefined> {
  const receipt = await l2.getTransactionReceipt({ hash: bridge.txHash as Hex });
  if (receipt.status === 'reverted') return { failed: { kind: 'failed', reason: 'source-tx-reverted' } };
  const message = arbitrumWithdrawalMessage(receipt.logs);
  if (matchesBridge(message, bridge)) return message;
  return safeExecutionFailed(receipt.logs, bridge.account)
    ? { failed: { kind: 'failed', reason: 'safe-tx-reverted' } }
    : undefined;
}

/**
 * Where an Arbitrum to Ethereum withdrawal stands. Its message is read from
 * the L2 receipt and must be the USDS withdrawal this bridge recorded (amount
 * and recipient). Arrived once the outbox spent it, by anyone; executable once
 * the newest confirmed send root commits to it, about 6.5 days after it was
 * sent; that root is not looked for until a day before. A failed read is null:
 * nothing changes.
 */
export async function arbitrumWithdrawalProgress(
  bridge: PendingBridge & { from: 'arbitrum' },
  context: AdapterContext,
  now: number
): Promise<BridgeProgress | null> {
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient('arbitrum');
  if (!l1 || !l2 || !bridge.txHash || bridge.to !== 'ethereum') return null;
  try {
    // A Safe's or a bundle's sent action is settled by the tracker.
    const sent = bridge.actions.find(action => action.status === 'sent' && !action.safe && !action.bundle);
    const settled = sent && (await settleSentAction(l1, sent, now, L1_SENT_ACTION_DROPPED_MS));
    if (settled) return settled;
    if (isSettled(bridge)) return null;

    const message = await readMessage(l2, bridge);
    if (!message) return null;
    if ('failed' in message) return message.failed;
    const spent = await l1.readContract({
      address: ARBITRUM_WITHDRAWAL.outbox,
      abi: arbitrumOutboxAbi,
      functionName: 'isSpent',
      args: [message.position]
    });
    if (spent) return { kind: 'arrived' };
    const etaAt = Number(message.timestamp) * 1000 + ARBITRUM_CONFIRM_MS;
    const confirmed = now >= etaAt - CONFIRM_LEAD_MS ? await readConfirmedSend(l1, l2) : undefined;
    if (confirmed && confirmed.size > message.position) return { kind: 'ready', nextAction: 'finalize' };
    return { kind: 'waiting', etaAt, nextAction: 'finalize' };
  } catch {
    return null;
  }
}

/**
 * The outbox execute of a bridge's withdrawal, built when it is sent: the
 * proof NodeInterface returns against the newest confirmed send root, only
 * when that root is the outbox's and the proven leaf is this message.
 */
export async function arbitrumExecuteFromChain({
  l1,
  l2,
  bridge
}: {
  l1: ChainReader;
  l2: ChainReader;
  bridge: PendingBridge;
}) {
  if (!bridge.txHash) throw new Error("The withdrawal's transaction isn't known yet.");
  const message = await readMessage(l2, bridge);
  if (!message || 'failed' in message) throw new Error("The withdrawal doesn't match this bridge.");
  const confirmed = await readConfirmedSend(l1, l2);
  if (!confirmed || confirmed.size <= message.position)
    throw new Error("The rollup hasn't confirmed the withdrawal yet.");
  const [send, root, proof] = await l2.readContract({
    address: NODE_INTERFACE,
    abi: nodeInterfaceOutboxAbi,
    functionName: 'constructOutboxProof',
    args: [confirmed.size, message.position]
  });
  const l2BlockHash = await l1.readContract({
    address: ARBITRUM_WITHDRAWAL.outbox,
    abi: arbitrumOutboxAbi,
    functionName: 'roots',
    args: [root]
  });
  if (root !== confirmed.sendRoot || l2BlockHash === zeroHash || send !== arbitrumItemHash(message))
    throw new Error("The withdrawal's proof doesn't match the confirmed root.");
  return arbitrumExecuteCall({ message, proof });
}
