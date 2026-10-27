import { getAddress, isAddressEqual, type Address, type Hex } from 'viem';
import { isSettled, type BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { l2CrossDomainMessengerAbi, type OpStackNetworkId } from '../nativeDeposit/contracts';
import { safeExecutionFailed } from '../safe';
import { settleSentAction } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import { OP_STACK_WITHDRAWAL, optimismPortalAbi } from './contracts';
import { opStackWithdrawalMessage } from './opStack';
import {
  pickProveGame,
  readPortalSystem,
  readProofState,
  readProvers,
  type ProofState
} from './opStackStatus';

const readMessage = (
  l1: ChainReader,
  network: OpStackNetworkId,
  functionName: 'successfulMessages' | 'failedMessages',
  msgHash: Hex
) =>
  l1.readContract({
    address: OP_STACK_WITHDRAWAL[network].l1Messenger,
    abi: l2CrossDomainMessengerAbi,
    functionName,
    args: [msgHash]
  });

/** The wallet that sent the bridge's confirmed prove: a Safe or a bundle proves as the account itself. */
async function ownProver(l1: ChainReader, bridge: PendingBridge): Promise<Address | undefined> {
  const prove = bridge.actions.findLast(action => action.action === 'prove' && action.status === undefined);
  if (!prove) return undefined;
  if (prove.safe || prove.bundle) return getAddress(bridge.account);
  return (await l1.getTransaction({ hash: prove.txHash as Hex })).from;
}

const earliest = (states: ProofState[]) =>
  states
    .filter((state): state is Extract<ProofState, { kind: 'maturing' }> => state.kind === 'maturing')
    .sort((a, b) => a.etaAt - b.etaAt)[0];

/**
 * Where an OP Stack to Ethereum withdrawal stands. Its message is read from
 * the L2 receipt and must be the USDS withdrawal this bridge recorded (amount
 * and recipient). Arrived only once the L1 messenger relayed it, by anyone; a
 * finalized withdrawal whose relay failed is offered as a retry on Ethereum.
 * Before that, every prover's proof is read: one that `checkWithdrawal` passes
 * is offered as the finalize, the earliest maturing one gives the ETA, and
 * only when none is valid is a prove offered, once a game covers it. Only the
 * newest proofs are read, plus the bridge's own: a confirmed prove is
 * invalidated, so the prove is offered again, only when its own proof became
 * invalid. A failed read is null: nothing changes.
 */
export async function opStackWithdrawalProgress(
  bridge: PendingBridge & { from: OpStackNetworkId },
  context: AdapterContext,
  now: number
): Promise<BridgeProgress | null> {
  const network = bridge.from;
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient(network);
  if (!l1 || !l2 || !bridge.txHash || bridge.to !== 'ethereum') return null;
  try {
    // A Safe's or a bundle's sent action is settled by the tracker.
    const sent = bridge.actions.find(action => action.status === 'sent' && !action.safe && !action.bundle);
    const settled = sent && (await settleSentAction(l1, sent, now));
    if (settled) return settled;
    // A settled bridge is only read for an action it sent.
    if (isSettled(bridge)) return null;

    const receipt = await l2.getTransactionReceipt({ hash: bridge.txHash as Hex });
    if (receipt.status === 'reverted') return { kind: 'failed', reason: 'source-tx-reverted' };
    const message = opStackWithdrawalMessage(receipt.logs, network);
    const recipient = getAddress(bridge.recipient ?? bridge.account);
    if (!message || message.amount !== bridge.amount || !isAddressEqual(message.to, recipient))
      return safeExecutionFailed(receipt.logs, bridge.account)
        ? { kind: 'failed', reason: 'safe-tx-reverted' }
        : null;
    const { withdrawal, msgHash } = message;
    // A retried message stays in failedMessages, so success is read first.
    if (await readMessage(l1, network, 'successfulMessages', msgHash)) return { kind: 'arrived' };

    const system = await readPortalSystem(l1, network);
    const finalized = await l1.readContract({
      address: system.portal,
      abi: optimismPortalAbi,
      functionName: 'finalizedWithdrawals',
      args: [withdrawal.withdrawalHash]
    });
    if (finalized) {
      return (await readMessage(l1, network, 'failedMessages', msgHash))
        ? { kind: 'ready', nextAction: 'replay', routeData: { msgHash, relayCalldata: withdrawal.data } }
        : { kind: 'waiting' };
    }

    const own = await ownProver(l1, bridge);
    const newest = await readProvers(l1, system, withdrawal.withdrawalHash);
    const provers = own && !newest.some(prover => isAddressEqual(prover, own)) ? [...newest, own] : newest;
    const states = (
      await Promise.all(provers.map(prover => readProofState(l1, system, withdrawal.withdrawalHash, prover)))
    ).filter(state => state !== undefined);
    const finalizable = states.find(state => state.kind === 'finalizable');
    if (finalizable)
      return { kind: 'ready', nextAction: 'finalize', routeData: { prover: finalizable.prover } };
    const maturing = earliest(states);
    if (maturing)
      return {
        kind: 'waiting',
        etaAt: maturing.etaAt,
        nextAction: 'finalize',
        routeData: { prover: maturing.prover }
      };
    if (own) {
      // No proof of its own found yet is a lagging read; re-proving would reset its clock.
      const mine = states.find(state => state.kind === 'invalid' && isAddressEqual(state.prover, own));
      return mine ? { kind: 'action-invalidated', action: 'prove' } : null;
    }

    const block = await l2.getBlock({ blockNumber: receipt.blockNumber });
    const game = await pickProveGame({
      l1,
      l2,
      network,
      system,
      withdrawalBlock: { number: block.number, timestamp: block.timestamp },
      now
    });
    return game
      ? {
          kind: 'ready',
          nextAction: 'prove',
          routeData: { gameIndex: game.index.toString(), l2BlockNumber: game.l2BlockNumber.toString() }
        }
      : { kind: 'waiting', nextAction: 'prove' };
  } catch {
    return null;
  }
}
