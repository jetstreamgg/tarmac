import type { Hex } from 'viem';
import { isSettled, type BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { safeExecutionFailed } from '../safe';
import { settleSentAction } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import { L2_CROSS_DOMAIN_MESSENGER, l2CrossDomainMessengerAbi, type OpStackNetworkId } from './contracts';
import { opStackDepositMessage } from './opStack';

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
 * messenger relayed it; a failed relay is offered as a replay. A receipt with
 * no Sky message fails only when the sender's Safe reported its execution
 * failed; any other such receipt, or a failed read, is null: nothing changes.
 */
export async function opStackDepositProgress(
  bridge: PendingBridge & { to: OpStackNetworkId },
  context: AdapterContext,
  now: number
): Promise<BridgeProgress | null> {
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient(bridge.to);
  if (!l1 || !l2 || !bridge.txHash) return null;
  try {
    // A Safe's sent replay is settled by the tracker.
    const sent = bridge.actions.find(
      action => action.status === 'sent' && !action.safe && action.action === 'replay'
    );
    const settled = sent && (await settleSentAction(l2, sent, now));
    if (settled) return settled;
    // A settled bridge is only read for an action it sent.
    if (isSettled(bridge)) return null;

    const receipt = await l1.getTransactionReceipt({ hash: bridge.txHash as Hex });
    if (receipt.status === 'reverted') return { kind: 'failed', reason: 'source-tx-reverted' };
    const message = opStackDepositMessage(receipt.logs, bridge.to);
    if (!message)
      return safeExecutionFailed(receipt.logs, bridge.account)
        ? { kind: 'failed', reason: 'safe-tx-reverted' }
        : null;
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
