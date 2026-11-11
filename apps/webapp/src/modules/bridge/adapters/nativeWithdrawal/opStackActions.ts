import { getAddress, isAddress, type Client, type Hex } from 'viem';
import type { PendingBridge } from '../../model/types';
import type { OpStackNetworkId } from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import { matchesBridge } from './message';
import { opStackFinalizeCall, opStackWithdrawalMessage } from './opStack';
import { buildOpStackProve } from './opStackProve';
import { readPortalSystem, readProofState } from './opStackStatus';

/**
 * The Ethereum call of a bridge's next OP Stack withdrawal action, read from
 * the chain when it is built. A prove is built against the game the tracker
 * picked; a finalize names the prover the tracker found and is only built
 * while `checkWithdrawal` passes with that proof. Throws when the action
 * can't be sent now.
 */
export async function opStackWithdrawalActionCall({
  action,
  l1,
  l2,
  network,
  bridge
}: {
  action: 'prove' | 'finalize';
  l1: ChainReader;
  /** Serves the L2's receipts and storage proofs. */
  l2: ChainReader & Client;
  network: OpStackNetworkId;
  bridge: Pick<PendingBridge, 'txHash' | 'amount' | 'recipient' | 'account' | 'routeData'>;
}) {
  if (!bridge.txHash) throw new Error("The withdrawal's transaction isn't known yet.");
  const receipt = await l2.getTransactionReceipt({ hash: bridge.txHash as Hex });
  const recipient = getAddress(bridge.recipient ?? bridge.account);
  if (action === 'prove')
    return buildOpStackProve({
      l1,
      l2,
      network,
      logs: receipt.logs,
      amount: bridge.amount,
      recipient,
      routeData: bridge.routeData
    });

  const message = opStackWithdrawalMessage(receipt.logs, network);
  if (!matchesBridge(message, bridge)) throw new Error("The withdrawal doesn't match this bridge.");
  const prover = bridge.routeData?.prover;
  if (!prover || !isAddress(prover)) throw new Error('No proof of the withdrawal is known yet.');
  const system = await readPortalSystem(l1, network);
  const proof = await readProofState(l1, system, message.withdrawal.withdrawalHash, getAddress(prover));
  if (proof?.kind !== 'finalizable') throw new Error("The withdrawal can't be finalized yet.");
  return opStackFinalizeCall({ network, withdrawal: message.withdrawal, proofSubmitter: proof.prover });
}
