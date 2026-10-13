import { TransactionReceiptNotFoundError, type Hex } from 'viem';
import type { BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import type { AdapterContext, ChainReader } from '../types';
import { L2_CROSS_DOMAIN_MESSENGER, l2CrossDomainMessengerAbi, type OpStackNetworkId } from './contracts';
import { opStackDepositMessage } from './opStack';

/** A sent replay's L2 receipt settles it; undefined while it isn't mined. */
async function settleReplay(l2: ChainReader, txHash: string): Promise<BridgeProgress | undefined> {
  try {
    const receipt = await l2.getTransactionReceipt({ hash: txHash as Hex });
    return receipt.status === 'success'
      ? { kind: 'action-confirmed', action: 'replay', txHash }
      : { kind: 'action-dropped', txHash };
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return undefined;
    throw error;
  }
}

const readMessage = (l2: ChainReader, functionName: 'successfulMessages' | 'failedMessages', msgHash: Hex) =>
  l2.readContract({
    address: L2_CROSS_DOMAIN_MESSENGER,
    abi: l2CrossDomainMessengerAbi,
    functionName,
    args: [msgHash]
  });

/**
 * Where an Ethereum to OP Stack deposit stands: its message is read from the
 * Ethereum receipt and looked up on the L2 messenger. Arrived only once the
 * messenger relayed it; a failed relay is offered as a replay. Any read that
 * fails, or a receipt with no Sky message, is null: nothing changes.
 */
export async function opStackDepositProgress(
  bridge: PendingBridge & { to: OpStackNetworkId },
  context: AdapterContext
): Promise<BridgeProgress | null> {
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient(bridge.to);
  if (!l1 || !l2 || !bridge.txHash) return null;
  try {
    // A Safe's sent replay is settled by the tracker.
    const sent = bridge.actions.find(
      action => action.status === 'sent' && !action.safe && action.action === 'replay'
    );
    const settled = sent && (await settleReplay(l2, sent.txHash));
    if (settled) return settled;

    const receipt = await l1.getTransactionReceipt({ hash: bridge.txHash as Hex });
    if (receipt.status === 'reverted') return { kind: 'failed', reason: 'source-tx-reverted' };
    const message = opStackDepositMessage(receipt.logs, bridge.to);
    if (!message) return null;
    // A replayed message stays in failedMessages, so success is read first.
    const [successful, failed] = await Promise.all([
      readMessage(l2, 'successfulMessages', message.msgHash),
      readMessage(l2, 'failedMessages', message.msgHash)
    ]);
    if (successful) return { kind: 'arrived' };
    if (failed) return { kind: 'ready', nextAction: 'replay', routeData: message };
    return { kind: 'waiting' };
  } catch {
    return null;
  }
}
