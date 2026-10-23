import { getAddress, isHex, type Hex } from 'viem';
import { isSettled, type BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { safeExecutionFailed } from '../safe';
import { settleSentAction } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import {
  CCTP_DOMAIN,
  MESSAGE_TRANSMITTER_V2,
  messageTransmitterV2Abi,
  type CctpL2NetworkId
} from './contracts';
import type { AttestationReader, IrisAttestedMessage } from './iris';
import { decodeCctpMessage, isAttestedCopy, isCctpMessageExpired, sourceBurnMessages } from './message';

/** The attested message a ready bridge claims with, as stored in its routeData. */
export function cctpClaimMessage(
  routeData: Record<string, string> | undefined
): IrisAttestedMessage | undefined {
  const { cctpMessage: message, cctpAttestation: attestation } = routeData ?? {};
  return isHex(message) && isHex(attestation) && message !== '0x' && attestation !== '0x'
    ? { message, attestation }
    : undefined;
}

const toRouteData = ({ message, attestation }: IrisAttestedMessage) => ({
  cctpMessage: message,
  cctpAttestation: attestation
});

async function attestedMessage({
  bridge,
  source,
  l1,
  readAttestations
}: {
  bridge: PendingBridge & { from: CctpL2NetworkId };
  source: Hex;
  l1: ChainReader;
  readAttestations: AttestationReader;
}): Promise<IrisAttestedMessage | undefined> {
  const stored = cctpClaimMessage(bridge.routeData);
  const block = await l1.getBlockNumber();
  if (stored && isAttestedCopy(stored.message, source) && !isCctpMessageExpired(stored.message, block))
    return stored;
  const attested = await readAttestations(CCTP_DOMAIN[bridge.from], bridge.txHash as Hex);
  return attested.find(
    ({ message }) => isAttestedCopy(message, source) && !isCctpMessageExpired(message, block)
  );
}

/**
 * Where an L2 to Ethereum CCTP bridge stands. The burn is read from the L2
 * receipt and must be exactly the one the app built for this bridge; Circle's
 * attested copy of it, from `readAttestations`, must match it byte for byte
 * outside the fields an attestation sets. Its nonce, used on Ethereum's
 * MessageTransmitter, means it was received, by the user's claim or anyone
 * else's; until then the attested message is offered as the claim. A convert
 * sent once it settled is read from its Ethereum receipt alone. A receipt
 * with no such burn fails only when the sender's Safe reported its execution
 * failed; any other such receipt, or a failed read, is null: nothing changes.
 */
export async function cctpProgress(
  bridge: PendingBridge & { from: CctpL2NetworkId },
  context: AdapterContext,
  now: number,
  readAttestations: AttestationReader
): Promise<BridgeProgress | null> {
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient(bridge.from);
  if (!l1 || !l2 || !bridge.txHash || bridge.to !== 'ethereum') return null;
  try {
    // A Safe's sent claim or convert is settled by the tracker.
    const sent = bridge.actions.find(
      action =>
        action.status === 'sent' && !action.safe && (action.action === 'claim' || action.action === 'convert')
    );
    const settled = sent && (await settleSentAction(l1, sent, now));
    if (settled) return settled;
    // Only a convert sent after the claim is still read for a settled bridge.
    if (isSettled(bridge)) return null;

    const receipt = await l2.getTransactionReceipt({ hash: bridge.txHash as Hex });
    if (receipt.status === 'reverted') return { kind: 'failed', reason: 'source-tx-reverted' };
    const sender = getAddress(bridge.account);
    const sources = sourceBurnMessages(receipt.logs, {
      from: bridge.from,
      amount: bridge.amount,
      sender,
      mintRecipient: getAddress(bridge.recipient ?? sender)
    });
    if (sources.length === 0)
      return safeExecutionFailed(receipt.logs, bridge.account)
        ? { kind: 'failed', reason: 'safe-tx-reverted' }
        : null;
    // Two identical burns in one transaction can't be told apart; neither is offered.
    if (sources.length > 1) return null;

    const attested = await attestedMessage({ bridge, source: sources[0], l1, readAttestations });
    if (!attested) return { kind: 'waiting' };
    const used = await l1.readContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: messageTransmitterV2Abi,
      functionName: 'usedNonces',
      args: [decodeCctpMessage(attested.message).nonce]
    });
    if (used !== 0n) return { kind: 'arrived' };
    return { kind: 'ready', nextAction: 'claim', routeData: toRouteData(attested) };
  } catch {
    return null;
  }
}
